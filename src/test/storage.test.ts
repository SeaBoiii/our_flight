import { describe, expect, it, vi } from 'vitest';
import {
  clearRememberedInvitation,
  clearDraft,
  clearRsvpReceipt,
  clearSavedGuestData,
  legacyTokenFromHash,
  readRememberedInvitation,
  readDraft,
  readRsvpReceipt,
  readRsvpDraftState,
  readRsvpReceiptState,
  saveDraft,
  saveRememberedInvitation,
  saveRsvpReceipt,
  type SavedInvitation,
  type SavedRsvpReceipt,
} from '../storage';
import type { RsvpDraft } from '../types';

const saved: SavedInvitation = {
  version: 4,
  fingerprint: 'f'.repeat(64),
  side: 'bride',
  cabinClass: 'economy',
  credential: { kind: 'class-code', value: 'ALPHA123' },
};

describe('RSVP draft storage', () => {
  const draft: RsvpDraft = {
    responseId: '123e4567-e89b-42d3-a456-426614174000',
    inviteeName: 'Aminah', message: '',
    responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
  };

  it('restores the exact unfinished response and clears it on request', () => {
    expect(saveDraft(saved.fingerprint, draft)).toBe(true);
    expect(readDraft(saved.fingerprint)).toEqual(draft);
    clearDraft(saved.fingerprint);
    expect(readDraft(saved.fingerprint)).toBeNull();
  });

  it.each([
    null,
    { ...draft, responses: [null] },
    { ...draft, responses: ['day22'] },
    { ...draft, responses: [{ eventId: 'other', attendance: 'attending', partySize: '2' }] },
    { ...draft, responses: [{ eventId: 'day22', attendance: 'maybe', partySize: '2' }] },
    { ...draft, responses: [{ eventId: 'day22', attendance: 'attending', partySize: 2 }] },
    { ...draft, responses: [draft.responses[0], draft.responses[0]] },
    { ...draft, submissionLocale: 'unknown' },
    { ...draft, submissionState: 'success' },
  ])('ignores malformed draft data instead of breaking the form: %j', (value) => {
    window.localStorage.setItem(`our-flight:rsvp:${saved.fingerprint}`, JSON.stringify(value));
    expect(readDraft(saved.fingerprint)).toBeNull();
  });

  it('reports failed persistence without throwing or losing the in-memory response', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(saveDraft(saved.fingerprint, draft)).toBe(false);
    expect(readRsvpDraftState(saved.fingerprint)).toEqual({ draft, persisted: false });
    expect(draft.inviteeName).toBe('Aminah');
  });

  it('prefers the latest visit response to a stale disk draft when later writes and removal fail', () => {
    saveDraft(saved.fingerprint, draft);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    const latest = { ...draft, message: 'Latest answers' };
    expect(saveDraft(saved.fingerprint, latest)).toBe(false);
    expect(window.localStorage.getItem(`our-flight:rsvp:${saved.fingerprint}`)).not.toContain('Latest answers');
    expect(readDraft(saved.fingerprint)).toEqual(latest);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    clearDraft(saved.fingerprint);
    expect(readDraft(saved.fingerprint)).toBeNull();
  });
});

describe('verified RSVP receipt storage', () => {
  const receipt: SavedRsvpReceipt = {
    version: 1,
    responseId: '123e4567-e89b-42d3-a456-426614174000',
    confirmedAt: '2026-09-27T00:00:00.000Z',
    responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
  };

  it('reads legacy receipts unchanged and matches the complete invitation scope', () => {
    const extraFields = { ...receipt, guestName: 'Unexpected legacy name', inviteeName: 'Private guest', message: 'Private message', credential: 'secret' };
    expect(saveRsvpReceipt(saved.fingerprint, extraFields)).toBe(true);
    expect(readRsvpReceipt(saved.fingerprint, ['day22'])).toEqual(receipt);
    const stored = window.localStorage.getItem(`our-flight:receipt:${saved.fingerprint}`)!;
    expect(stored).not.toMatch(/Unexpected|guestName|Private|inviteeName|message|credential|secret/);
    expect(readRsvpReceipt(saved.fingerprint, ['day21'])).toBeNull();
    expect(readRsvpReceipt(saved.fingerprint, ['day21', 'day22'])).toBeNull();
    expect(readRsvpReceipt('different-fingerprint')).toBeNull();
  });

  it.each([
    null,
    { ...receipt, version: 3 },
    { ...receipt, responseId: 'not-an-id' },
    { ...receipt, confirmedAt: '2026-09-27' },
    { ...receipt, confirmedAt: '2026-02-31T00:00:00.000Z' },
    { ...receipt, confirmedAt: 'invalid' },
    { ...receipt, responses: [] },
    { ...receipt, responses: [null] },
    { ...receipt, responses: [receipt.responses[0], receipt.responses[0]] },
    { ...receipt, responses: [{ eventId: 'day23', attendance: 'attending', partySize: '2' }] },
    { ...receipt, responses: [{ eventId: 'day22', attendance: '', partySize: '2' }] },
    { ...receipt, responses: [{ eventId: 'day22', attendance: 'attending', partySize: '0' }] },
    { ...receipt, responses: [{ eventId: 'day22', attendance: 'attending', partySize: '1.5' }] },
    { ...receipt, responses: [{ eventId: 'day22', attendance: 'attending', partySize: '9007199254740992' }] },
    { ...receipt, responses: [{ eventId: 'day22', attendance: 'not-attending', partySize: '2' }] },
  ])('rejects malformed or incomplete confirmations: %j', (value) => {
    window.localStorage.setItem(`our-flight:receipt:${saved.fingerprint}`, JSON.stringify(value));
    expect(readRsvpReceipt(saved.fingerprint)).toBeNull();
  });

  it('stores a trimmed v2 guest name with the confirmed response while excluding the personal message and credential', () => {
    const named: SavedRsvpReceipt = { ...receipt, version: 2, guestName: '  Aminah Rahman  ' };
    expect(saveRsvpReceipt(saved.fingerprint, { ...named, message: 'Private message', credential: 'secret' } as SavedRsvpReceipt)).toBe(true);
    const expected = { ...named, guestName: 'Aminah Rahman' };
    expect(readRsvpReceipt(saved.fingerprint, ['day22'])).toEqual(expected);
    const stored = window.localStorage.getItem(`our-flight:receipt:${saved.fingerprint}`)!;
    expect(JSON.parse(stored)).toEqual(expected);
    expect(stored).not.toMatch(/Private message|message|credential|secret/);
  });

  it.each([undefined, null, 123, {}, '', '   ', 'a'.repeat(101)])('omits an invalid optional v2 name without losing its verified receipt: %j', (guestName) => {
    window.localStorage.setItem(`our-flight:receipt:${saved.fingerprint}`, JSON.stringify({ ...receipt, version: 2, guestName }));
    expect(readRsvpReceipt(saved.fingerprint)).toEqual({ ...receipt, version: 2 });
  });

  it('accepts a trimmed 100-character name while isolating names by fingerprint and clearing only the selected receipt', () => {
    const first: SavedRsvpReceipt = { ...receipt, version: 2, guestName: ` ${'a'.repeat(100)} ` };
    const second: SavedRsvpReceipt = { ...receipt, version: 2, guestName: 'Nur Aisyah' };
    expect(saveRsvpReceipt(saved.fingerprint, first)).toBe(true);
    expect(saveRsvpReceipt('another-invitation', second)).toBe(true);
    expect(readRsvpReceipt(saved.fingerprint)?.guestName).toBe('a'.repeat(100));
    expect(readRsvpReceipt('another-invitation')?.guestName).toBe('Nur Aisyah');
    clearRsvpReceipt(saved.fingerprint);
    expect(readRsvpReceipt(saved.fingerprint)).toBeNull();
    expect(readRsvpReceipt('another-invitation')?.guestName).toBe('Nur Aisyah');
    clearSavedGuestData();
    expect(readRsvpReceipt('another-invitation')).toBeNull();
  });

  it('retains mixed attendance without inventing party sizes for declines', () => {
    const mixed: SavedRsvpReceipt = { ...receipt, responses: [
      { eventId: 'day21', attendance: 'not-attending', partySize: '' },
      ...receipt.responses,
    ] };
    expect(saveRsvpReceipt(saved.fingerprint, mixed)).toBe(true);
    expect(readRsvpReceipt(saved.fingerprint, ['day22', 'day21'])).toEqual(mixed);
  });

  it('reports blocked receipt storage safely', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(saveRsvpReceipt(saved.fingerprint, receipt)).toBe(false);
    expect(readRsvpReceiptState(saved.fingerprint)).toEqual({ receipt, persisted: false });
  });

  it('clears visit-only drafts and receipts even when all storage access is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const draft = { responseId: receipt.responseId, inviteeName: 'Guest', message: 'Private', responses: receipt.responses };
    expect(saveDraft(saved.fingerprint, draft)).toBe(false);
    expect(saveRsvpReceipt(saved.fingerprint, receipt)).toBe(false);
    expect(readDraft(saved.fingerprint)).toEqual(draft);
    expect(readRsvpReceipt(saved.fingerprint)).toEqual(receipt);
    clearSavedGuestData();
    expect(readDraft(saved.fingerprint)).toBeNull();
    expect(readRsvpReceipt(saved.fingerprint)).toBeNull();
  });

  it('preserves immutable response snapshots and promotes them when persistent storage becomes available', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const original: SavedRsvpReceipt = { ...receipt, responses: receipt.responses.map((answer) => ({ ...answer })) };
    expect(saveRsvpReceipt(saved.fingerprint, original)).toBe(false);
    original.responses[0].partySize = '99';
    expect(readRsvpReceipt(saved.fingerprint)).toEqual(receipt);
    const read = readRsvpReceipt(saved.fingerprint)!;
    read.responses[0].partySize = '50';
    expect(readRsvpReceipt(saved.fingerprint)).toEqual(receipt);
    write.mockRestore();
    expect(saveRsvpReceipt(saved.fingerprint, receipt)).toBe(true);
    expect(readRsvpReceiptState(saved.fingerprint)).toEqual({ receipt, persisted: true });
  });

  it('clears all our access, drafts and receipts while preserving preferences and unrelated storage', () => {
    for (const target of [window.localStorage, window.sessionStorage]) {
      target.setItem('our-flight:access', 'access');
      target.setItem('our-flight:rsvp:first', 'draft one');
      target.setItem('our-flight:rsvp:second', 'draft two');
      target.setItem('our-flight:receipt:first', 'receipt one');
      target.setItem('our-flight:receipt:second', 'receipt two');
      target.setItem('our-flight:language', 'ms');
      target.setItem('our-flight:simple-view', 'true');
      target.setItem('another-app:data', 'keep');
    }
    clearSavedGuestData();
    for (const target of [window.localStorage, window.sessionStorage]) {
      expect(target.length).toBe(3);
      expect(target.getItem('our-flight:language')).toBe('ms');
      expect(target.getItem('our-flight:simple-view')).toBe('true');
      expect(target.getItem('another-app:data')).toBe('keep');
    }
  });

  it('suppresses stale disk records after a failed device clear and continues clearing the other keys', () => {
    const draft = { responseId: receipt.responseId, inviteeName: 'Private guest', message: 'Private message', responses: receipt.responses };
    saveDraft(saved.fingerprint, draft);
    saveRsvpReceipt(saved.fingerprint, receipt);
    window.localStorage.setItem('our-flight:rsvp:second-invitation', JSON.stringify(draft));
    window.localStorage.setItem('our-flight:language', 'ms');
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key.endsWith(saved.fingerprint)) throw new DOMException('Blocked', 'SecurityError');
      remove.call(this, key);
    });
    clearSavedGuestData();
    expect(window.localStorage.getItem(`our-flight:rsvp:${saved.fingerprint}`)).toContain('Private guest');
    expect(window.localStorage.getItem(`our-flight:receipt:${saved.fingerprint}`)).not.toBeNull();
    expect(readDraft(saved.fingerprint)).toBeNull();
    expect(readRsvpReceipt(saved.fingerprint)).toBeNull();
    expect(window.localStorage.getItem('our-flight:rsvp:second-invitation')).toBeNull();
    expect(window.localStorage.getItem('our-flight:language')).toBe('ms');
  });
});

describe('persistent invitation storage', () => {
  it('remembers a versioned invitation in localStorage without an expiry', () => {
    saveRememberedInvitation(saved);
    expect(readRememberedInvitation()).toEqual(saved);
    expect(JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}')).toEqual(saved);
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem('our-flight:access')).not.toContain('expiresAt');
  });

  it('discards old expiring session access without promoting it or deleting RSVP drafts', () => {
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({ ...saved, version: 3, expiresAt: '2027-08-01T00:30:00.000Z' }));
    window.localStorage.setItem(`our-flight:rsvp:${saved.fingerprint}`, '{"saved":true}');
    expect(readRememberedInvitation()).toBeNull();
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${saved.fingerprint}`)).toBe('{"saved":true}');
  });

  it('forgets access in both storage locations while preserving language and RSVP drafts', () => {
    saveRememberedInvitation(saved);
    window.sessionStorage.setItem('our-flight:access', 'old-session');
    window.localStorage.setItem('our-flight:language', 'ms');
    window.localStorage.setItem(`our-flight:rsvp:${saved.fingerprint}`, '{"saved":true}');
    clearRememberedInvitation();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem('our-flight:language')).toBe('ms');
    expect(window.localStorage.getItem(`our-flight:rsvp:${saved.fingerprint}`)).toBe('{"saved":true}');
  });

  it.each([
    { ...saved, version: 3 },
    { ...saved, version: 5 },
    { ...saved, side: undefined },
    { ...saved, side: 'guest' },
    { ...saved, cabinClass: 'unknown' },
    { ...saved, fingerprint: 'invalid' },
    { ...saved, credential: { kind: 'class-code', value: 'test-cloud 1' } },
    { ...saved, credential: { kind: 'class-code', value: 'alpha123' } },
    { ...saved, credential: { kind: 'legacy-token', value: 'short' } },
    { ...saved, credential: { kind: 'unknown', value: 'ALPHA123' } },
    null,
  ])('rejects malformed or unsupported persisted records: %j', (value) => {
    window.localStorage.setItem('our-flight:access', JSON.stringify(value));
    expect(readRememberedInvitation()).toBeNull();
  });

  it('fails gracefully when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(readRememberedInvitation()).toBeNull();
    expect(() => saveRememberedInvitation(saved)).not.toThrow();
    expect(() => clearRememberedInvitation()).not.toThrow();
  });
});

describe('private hash invitation route', () => {
  it('accepts a long opaque token without exposing it in the path', () => {
    const token = `invitation_${'a'.repeat(24)}`;
    expect(legacyTokenFromHash(`#/i/${token}`)).toBe(token);
  });

  it('rejects missing, short, or malformed links', () => {
    expect(legacyTokenFromHash('#/')).toBeNull();
    expect(legacyTokenFromHash('#/i/short')).toBeNull();
    expect(legacyTokenFromHash('#/i/not.allowed.token.value')).toBeNull();
  });

});
