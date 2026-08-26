import { describe, expect, it } from 'vitest';
import { invitationTokenFromHash } from '../storage';

describe('private hash invitation route', () => {
  it('accepts a long opaque token without exposing it in the path', () => {
    const token = 'a_secure_invitation_token_1234567890';
    expect(invitationTokenFromHash(`#/i/${token}`)).toBe(token);
  });

  it('rejects missing, short, or malformed links', () => {
    expect(invitationTokenFromHash('#/')).toBeNull();
    expect(invitationTokenFromHash('#/i/short')).toBeNull();
    expect(invitationTokenFromHash('#/i/not.allowed.token.value')).toBeNull();
  });
});
