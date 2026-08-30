import { describe, expect, it } from 'vitest';
import { legacyTokenFromHash, readSession, saveSession } from '../storage';

describe('private hash invitation route', () => {
  it('accepts a long opaque token without exposing it in the path', () => {
    const token = `invitation_${'a'.repeat(24)}`;
    expect(legacyTokenFromHash(`#/i/${token}`)).toBe(token);
  });

  it('stores a versioned class-code session with its class, fingerprint, and expiry', () => {
    const saved = {
      version: 3 as const,
      unlocked: true as const,
      fingerprint: 'f'.repeat(64),
      expiresAt: '2027-08-01T00:30:00.000Z',
      side: 'bride' as const,
      cabinClass: 'economy' as const,
      credential: { kind: 'class-code' as const, value: 'ALPHA123' },
    };
    saveSession(saved);
    expect(readSession()).toEqual(saved);
    expect(window.sessionStorage.getItem('our-flight:access')).toContain('ALPHA123');
  });

  it('rejects missing, short, or malformed links', () => {
    expect(legacyTokenFromHash('#/')).toBeNull();
    expect(legacyTokenFromHash('#/i/short')).toBeNull();
    expect(legacyTokenFromHash('#/i/not.allowed.token.value')).toBeNull();
  });

  it('rejects pre-side sessions, invalid sides, and non-canonical class codes', () => {
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 2,
      unlocked: true,
      expiresAt: '2027-08-01T00:30:00.000Z',
      fingerprint: 'f'.repeat(64),
      cabinClass: 'economy',
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    expect(readSession()).toBeNull();

    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: '2027-08-01T00:30:00.000Z',
      fingerprint: 'f'.repeat(64),
      side: 'guest',
      cabinClass: 'economy',
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    expect(readSession()).toBeNull();

    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: '2027-08-01T00:30:00.000Z',
      fingerprint: 'f'.repeat(64),
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'class-code', value: 'test-cloud 1' },
    }));
    expect(readSession()).toBeNull();
  });
});
