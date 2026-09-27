import type { AccessCredential, CabinClass, InvitationEvent, InvitationSide, Locale, RsvpDraft } from './types';
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

export type SavedRsvpDraft = RsvpDraft & {
  submissionLocale?: Locale;
  submissionState?: 'unconfirmed' | 'conflict';
};

// This is a device-local record of a verified server receipt, not a household
// identity or a live lookup. Version 2 may remember the submitted name for a
// personal welcome, only after server confirmation. Messages never belong here.
export type SavedRsvpReceipt = {
  version: 1 | 2;
  guestName?: string;
  responseId: string;
  confirmedAt: string;
  responses: RsvpDraft['responses'];
};

export type RsvpDraftState = { draft: SavedRsvpDraft; persisted: boolean };
export type RsvpReceiptState = { receipt: SavedRsvpReceipt; persisted: boolean };

// Eight current credentials and four legacy credentials fit within this bound.
// A document reload drops these fallbacks; ordinary keepsake navigation does not.
const VISIT_RECORD_LIMIT = 16;
const visitDrafts = new Map<string, RsvpDraftState | null>();
const visitReceipts = new Map<string, RsvpReceiptState | null>();

function rememberVisit<T>(records: Map<string, T>, fingerprint: string, value: T): void {
  records.delete(fingerprint);
  records.set(fingerprint, value);
  if (records.size > VISIT_RECORD_LIMIT) records.delete(records.keys().next().value!);
}

function copyDraft(draft: SavedRsvpDraft): SavedRsvpDraft {
  return { ...draft, responses: draft.responses.map((answer) => ({ ...answer })) };
}

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

export function readRsvpDraftState(fingerprint: string): RsvpDraftState | null {
  if (visitDrafts.has(fingerprint)) {
    const state = visitDrafts.get(fingerprint);
    return state ? { draft: copyDraft(state.draft), persisted: state.persisted } : null;
  }
  try {
    const raw = storage('local')?.getItem(draftKey(fingerprint));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedRsvpDraft> | null;
    if (
      !value
      || typeof value.responseId !== 'string'
      || typeof value.inviteeName !== 'string'
      || typeof value.message !== 'string'
      || !Array.isArray(value.responses)
      || value.responses.length > 2
      || (value.submissionLocale !== undefined && !['en', 'ms'].includes(value.submissionLocale))
      || (value.submissionState !== undefined && !['unconfirmed', 'conflict'].includes(value.submissionState))
    ) return null;
    const responses: RsvpDraft['responses'] = [];
    for (const answer of value.responses) {
      if (
        !answer || typeof answer !== 'object'
        || !['day21', 'day22'].includes(answer.eventId)
        || !['', 'attending', 'not-attending'].includes(answer.attendance)
        || typeof answer.partySize !== 'string'
        || responses.some((previous) => previous.eventId === answer.eventId)
      ) return null;
      responses.push({ eventId: answer.eventId, attendance: answer.attendance, partySize: answer.partySize });
    }
    const draft: SavedRsvpDraft = {
      responseId: value.responseId, inviteeName: value.inviteeName, message: value.message, responses,
      ...(value.submissionLocale ? { submissionLocale: value.submissionLocale } : {}),
      ...(value.submissionState ? { submissionState: value.submissionState } : {}),
    };
    rememberVisit(visitDrafts, fingerprint, { draft, persisted: true });
    return { draft: copyDraft(draft), persisted: true };
  } catch {
    return null;
  }
}

export function readDraft(fingerprint: string): SavedRsvpDraft | null {
  return readRsvpDraftState(fingerprint)?.draft ?? null;
}

export function saveDraft(fingerprint: string, draft: SavedRsvpDraft): boolean {
  const state: RsvpDraftState = { draft: copyDraft(draft), persisted: false };
  rememberVisit(visitDrafts, fingerprint, state);
  try {
    const target = storage('local');
    if (!target) return false;
    target.setItem(draftKey(fingerprint), JSON.stringify(state.draft));
    state.persisted = true;
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(fingerprint: string): void {
  // Suppress a stale disk value for this visit even if removeItem is blocked.
  rememberVisit(visitDrafts, fingerprint, null);
  try { storage('local')?.removeItem(draftKey(fingerprint)); } catch { /* Nothing else to clear. */ }
}

function receiptKey(fingerprint: string): string {
  return `our-flight:receipt:${fingerprint}`;
}

function validReceipt(value: unknown, allowedEventIds?: readonly InvitationEvent['id'][]): SavedRsvpReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const receipt = value as Partial<SavedRsvpReceipt>;
  if (
    (receipt.version !== 1 && receipt.version !== 2)
    || typeof receipt.responseId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.responseId)
    || typeof receipt.confirmedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.confirmedAt)
    || !Number.isFinite(Date.parse(receipt.confirmedAt))
    || new Date(receipt.confirmedAt).toISOString() !== receipt.confirmedAt
    || !Array.isArray(receipt.responses)
    || receipt.responses.length < 1 || receipt.responses.length > 2
  ) return null;
  const responses: RsvpDraft['responses'] = [];
  for (const answer of receipt.responses) {
    if (
      !answer || typeof answer !== 'object'
      || !['day21', 'day22'].includes(answer.eventId)
      || !['attending', 'not-attending'].includes(answer.attendance)
      || typeof answer.partySize !== 'string'
      || responses.some((previous) => previous.eventId === answer.eventId)
      || (answer.attendance === 'attending' && (
        !/^\d+$/.test(answer.partySize) || !Number.isSafeInteger(Number(answer.partySize)) || Number(answer.partySize) < 1
      ))
      || (answer.attendance === 'not-attending' && answer.partySize !== '')
    ) return null;
    responses.push({ eventId: answer.eventId, attendance: answer.attendance, partySize: answer.partySize });
  }
  // Require the complete invited event set; a partial/cross-invitation record
  // must never make a missing answer look like a decline.
  if (allowedEventIds && (
    responses.length !== allowedEventIds.length
    || responses.some((answer) => !allowedEventIds.includes(answer.eventId))
  )) return null;
  // A damaged optional display name must not erase an otherwise valid receipt
  // or encourage another submission. Legacy receipts never acquire a name.
  const guestName = receipt.version === 2 && typeof receipt.guestName === 'string'
    ? receipt.guestName.trim()
    : '';
  return {
    version: receipt.version,
    responseId: receipt.responseId,
    confirmedAt: receipt.confirmedAt,
    responses,
    ...(guestName && guestName.length <= 100 ? { guestName } : {}),
  };
}

export function readRsvpReceiptState(fingerprint: string, allowedEventIds?: readonly InvitationEvent['id'][]): RsvpReceiptState | null {
  if (visitReceipts.has(fingerprint)) {
    const state = visitReceipts.get(fingerprint);
    const receipt = state ? validReceipt(state.receipt, allowedEventIds) : null;
    return receipt && state ? { receipt, persisted: state.persisted } : null;
  }
  try {
    const raw = storage('local')?.getItem(receiptKey(fingerprint));
    const receipt = raw ? validReceipt(JSON.parse(raw), allowedEventIds) : null;
    if (!receipt) return null;
    rememberVisit(visitReceipts, fingerprint, { receipt, persisted: true });
    return { receipt: validReceipt(receipt)!, persisted: true };
  } catch {
    return null;
  }
}

export function readRsvpReceipt(fingerprint: string, allowedEventIds?: readonly InvitationEvent['id'][]): SavedRsvpReceipt | null {
  return readRsvpReceiptState(fingerprint, allowedEventIds)?.receipt ?? null;
}

export function saveRsvpReceipt(fingerprint: string, receipt: SavedRsvpReceipt): boolean {
  const value = validReceipt(receipt);
  if (!value) return false;
  const state: RsvpReceiptState = { receipt: value, persisted: false };
  rememberVisit(visitReceipts, fingerprint, state);
  try {
    const target = storage('local');
    if (!target) return false;
    target.setItem(receiptKey(fingerprint), JSON.stringify(value));
    state.persisted = true;
    return true;
  } catch {
    return false;
  }
}

export function clearRsvpReceipt(fingerprint: string): void {
  rememberVisit(visitReceipts, fingerprint, null);
  try { storage('local')?.removeItem(receiptKey(fingerprint)); } catch { /* Storage may be unavailable. */ }
}

export function clearSavedGuestData(): void {
  const knownKeys = [
    INVITATION_KEY,
    ...Array.from(visitDrafts.keys(), draftKey),
    ...Array.from(visitReceipts.keys(), receiptKey),
  ];
  visitDrafts.clear();
  visitReceipts.clear();
  const suppressLocalKey = (key: string) => {
    if (key.startsWith('our-flight:rsvp:')) rememberVisit(visitDrafts, key.slice('our-flight:rsvp:'.length), null);
    if (key.startsWith('our-flight:receipt:')) rememberVisit(visitReceipts, key.slice('our-flight:receipt:'.length), null);
  };
  for (const kind of ['local', 'session'] as const) {
    const target = storage(kind);
    if (!target) {
      if (kind === 'local') knownKeys.forEach(suppressLocalKey);
      continue;
    }
    const keys = new Set(knownKeys);
    try {
      for (let index = target.length - 1; index >= 0; index -= 1) {
        const key = target.key(index);
        if (key && (key === INVITATION_KEY || key.startsWith('our-flight:rsvp:') || key.startsWith('our-flight:receipt:'))) {
          keys.add(key);
        }
      }
    } catch { /* Still attempt all keys already known to this visit. */ }
    for (const key of keys) {
      try { target.removeItem(key); } catch {
        // A failed removal must not resurrect old personal answers on reopening
        // a keepsake or unlocking the same invitation during this visit.
        if (kind === 'local') suppressLocalKey(key);
      }
    }
  }
}
