import type { CabinClass, InvitationScope } from './types';
import { scopeForClass } from './invitation.server';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ACCESS_TOKEN_SECONDS = 60 * 30;
const SIGNATURE_PREFIX = 'our-flight-access-v1.';

export type AccessTokenPayload = {
  v: 1;
  cabinClass: CabinClass;
  scope: InvitationScope;
  iat: number;
  exp: number;
};

function isCabinClass(value: unknown): value is CabinClass {
  return value === 'economy' || value === 'premium-economy' || value === 'business' || value === 'first';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url value');
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
  if (!/^[A-Za-z0-9_-]{20,160}$/.test(token)) return null;
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

async function sign(encodedPayload: string): Promise<string> {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SIGNING_SECRET is not configured securely');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${SIGNATURE_PREFIX}${encodedPayload}`),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createAccessToken(cabinClass: CabinClass): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    v: 1,
    cabinClass,
    scope: scopeForClass(cabinClass),
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
  };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return {
    token: `${encodedPayload}.${await sign(encodedPayload)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export async function readAccessToken(value?: string): Promise<AccessTokenPayload | null> {
  if (!value || value.length > 1024) return null;
  const [encodedPayload, signature, extra] = value.split('.');
  if (!encodedPayload || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  try {
    const expectedSignature = await sign(encodedPayload);
    if (!constantTimeEqual(signature, expectedSignature)) return null;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as AccessTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.v !== 1) return null;
    if (!isCabinClass(payload.cabinClass)) return null;
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) return null;
    if (payload.iat > now + 60 || payload.exp <= now || payload.exp - payload.iat !== ACCESS_TOKEN_SECONDS) return null;
    if (scopeForClass(payload.cabinClass) !== payload.scope) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
  return match?.[1] ?? null;
}

export async function authenticateRequest(request: Request): Promise<AccessTokenPayload | null> {
  try {
    return await readAccessToken(bearerFromRequest(request) ?? undefined);
  } catch {
    return null;
  }
}

export function accessTokenIsConfigured(): boolean {
  return Boolean(process.env.SESSION_SIGNING_SECRET && process.env.SESSION_SIGNING_SECRET.length >= 32);
}

export function accessTokenSeconds(): number {
  return ACCESS_TOKEN_SECONDS;
}
