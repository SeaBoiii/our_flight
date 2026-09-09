import { describe, expect, it, vi } from 'vitest';
import {
  clearRememberedInvitation,
  legacyTokenFromHash,
  readRememberedInvitation,
  saveRememberedInvitation,
  type SavedInvitation,
} from '../storage';

const saved: SavedInvitation = {
  version: 4,
  fingerprint: 'f'.repeat(64),
  side: 'bride',
  cabinClass: 'economy',
  credential: { kind: 'class-code', value: 'ALPHA123' },
};

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
