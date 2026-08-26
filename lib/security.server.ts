import type { CabinClass, InvitationScope } from './types';
import { scopeForClass } from './invitation.server';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = 'our_flight_session';
const SESSION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  cabinClass: CabinClass;
  scope: InvitationScope;
  inviteTokenHash: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function inviteHashes(): Array<[CabinClass, string | undefined]> {
  return [
    ['economy', process.env.INVITE_TOKEN_HASH_ECONOMY],
    ['premium-economy', process.env.INVITE_TOKEN_HASH_PREMIUM],
    ['business', process.env.INVITE_TOKEN_HASH_BUSINESS],
    ['first', process.env.INVITE_TOKEN_HASH_FIRST],
  ];
}

export async function classForToken(token: string): Promise<CabinClass | null> {
  if (!token || token.length > 160) return null;
  const tokenHash = await sha256Hex(token);
  for (const [cabinClass, configuredHash] of inviteHashes()) {
    if (configuredHash && constantTimeEqual(tokenHash, configuredHash)) return cabinClass;
  }
  return null;
}

export async function validatePasscode(passcode: string): Promise<boolean> {
  const configuredHash = process.env.WEDDING_PASSCODE_HASH;
  if (!configuredHash || !passcode || passcode.length > 160) return false;
  return constantTimeEqual(await sha256Hex(passcode), configuredHash);
}

async function sign(value: string): Promise<string> {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) throw new Error('SESSION_SIGNING_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSession(cabinClass: CabinClass, inviteToken: string): Promise<string> {
  const payload: SessionPayload = {
    cabinClass,
    scope: scopeForClass(cabinClass),
    inviteTokenHash: await sha256Hex(inviteToken),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function readSession(value?: string): Promise<SessionPayload | null> {
  if (!value) return null;
  const [encodedPayload, signature, extra] = value.split('.');
  if (!encodedPayload || !signature || extra) return null;
  const expectedSignature = await sign(encodedPayload);
  if (!constantTimeEqual(signature, expectedSignature)) return null;
  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as SessionPayload;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (scopeForClass(payload.cabinClass) !== payload.scope) return null;
    if (!payload.inviteTokenHash || payload.inviteTokenHash.length !== 64) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionMaxAge(): number {
  return SESSION_SECONDS;
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const candidate = new URL(origin).origin;
    const allowed = new Set([new URL(request.url).origin]);
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN;
    if (configuredOrigin) allowed.add(new URL(configuredOrigin).origin);
    return allowed.has(candidate);
  } catch {
    return false;
  }
}
