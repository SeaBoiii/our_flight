import type { AccessCredential, CabinClass, InvitationSide, RsvpDraft } from './types';
import { sha256Hex } from './invitations';

const INVITATION_KEY = 'our-flight:access';
const LOCALE_KEY = 'our-flight:language';

export type SavedInvitation = {
  version: 4;
  fingerprint: string;
  side: InvitationSide;
  cabinClass: CabinClass;
  credential: AccessCredential;
};

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function legacyTokenFromHash(hash = window.location.hash): string | null {
  const match = /^#\/i\/([A-Za-z0-9_-]{20,160})\/?$/.exec(hash);
  return match?.[1] ?? null;
}

export function fingerprintCredential(credential: AccessCredential): Promise<string> {
  return sha256Hex(credential.value);
}

function discardLegacySession(): void {
  try { storage('session')?.removeItem(INVITATION_KEY); } catch { /* Storage may be unavailable. */ }
}

export function readRememberedInvitation(): SavedInvitation | null {
  // Expiring v3 sessions are intentionally not promoted to permanent access.
  // Guests check in once after upgrading; fingerprint-keyed RSVP drafts survive.
  discardLegacySession();
  try {
    const value = storage('local')?.getItem(INVITATION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<SavedInvitation>;
    const credentialValid = parsed.credential?.kind === 'class-code'
      ? typeof parsed.credential.value === 'string' && /^[A-Z0-9]{8,12}$/.test(parsed.credential.value)
      : parsed.credential?.kind === 'legacy-token'
        ? typeof parsed.credential.value === 'string' && /^[A-Za-z0-9_-]{20,160}$/.test(parsed.credential.value)
        : false;
    if (
      parsed.version !== 4
      || typeof parsed.fingerprint !== 'string'
      || !/^[a-f0-9]{64}$/i.test(parsed.fingerprint)
      || !['groom', 'bride'].includes(parsed.side ?? '')
      || !['economy', 'premium-economy', 'business', 'first'].includes(parsed.cabinClass ?? '')
      || !credentialValid
    ) return null;
    return parsed as SavedInvitation;
  } catch {
    return null;
  }
}

export function saveRememberedInvitation(value: SavedInvitation): void {
  discardLegacySession();
  try {
    storage('local')?.setItem(INVITATION_KEY, JSON.stringify(value));
  } catch {
    // The current in-memory visit remains available when storage is blocked.
  }
}

export function clearRememberedInvitation(): void {
  discardLegacySession();
  try { storage('local')?.removeItem(INVITATION_KEY); } catch { /* Nothing else to clear. */ }
}

export function readLocale(): 'en' | 'ms' {
  try { return storage('local')?.getItem(LOCALE_KEY) === 'ms' ? 'ms' : 'en'; } catch { return 'en'; }
}

export function saveLocale(locale: 'en' | 'ms'): void {
  try { storage('local')?.setItem(LOCALE_KEY, locale); } catch { /* Active for this visit. */ }
}

export function readReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function draftKey(fingerprint: string): string {
  return `our-flight:rsvp:${fingerprint}`;
}

export function readDraft(fingerprint: string): RsvpDraft | null {
  try {
    const raw = storage('local')?.getItem(draftKey(fingerprint));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RsvpDraft>;
    if (typeof value.responseId !== 'string' || typeof value.inviteeName !== 'string' || typeof value.message !== 'string' || !Array.isArray(value.responses)) return null;
    return value as RsvpDraft;
  } catch {
    return null;
  }
}

export function saveDraft(fingerprint: string, draft: RsvpDraft): void {
  try { storage('local')?.setItem(draftKey(fingerprint), JSON.stringify(draft)); } catch { /* Form remains usable. */ }
}

export function clearDraft(fingerprint: string): void {
  try { storage('local')?.removeItem(draftKey(fingerprint)); } catch { /* Nothing else to clear. */ }
}
