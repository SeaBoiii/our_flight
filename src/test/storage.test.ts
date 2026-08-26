import { describe, expect, it } from 'vitest';
import { invitationTokenFromHash, readSession, saveSession } from '../storage';

describe('private hash invitation route', () => {
  it('accepts a long opaque token without exposing it in the path', () => {
    const token = `invitation_${'a'.repeat(24)}`;
    expect(invitationTokenFromHash(`#/i/${token}`)).toBe(token);
  });

  it('stores only an unlock marker, token fingerprint, and expiry in session storage', () => {
    const saved = {
      unlocked: true as const,
      fingerprint: 'f'.repeat(64),
      expiresAt: '2027-08-01T00:30:00.000Z',
    };
    saveSession(saved);
    expect(readSession()).toEqual(saved);
    expect(window.sessionStorage.getItem('our-flight:access')).not.toContain('invitation_');
  });

  it('rejects missing, short, or malformed links', () => {
    expect(invitationTokenFromHash('#/')).toBeNull();
    expect(invitationTokenFromHash('#/i/short')).toBeNull();
    expect(invitationTokenFromHash('#/i/not.allowed.token.value')).toBeNull();
  });
});
