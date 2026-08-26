import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classForToken,
  createAccessToken,
  readAccessToken,
  sha256Hex,
  validatePasscode,
} from '../lib/security.server';

const inviteToken = 'economy_test_invitation_token_123456';
const passcode = 'test-wedding-passcode';

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-26T10:00:00+08:00'));
  vi.stubEnv('SESSION_SIGNING_SECRET', 'test-signing-secret-that-is-at-least-32-characters');
  vi.stubEnv('INVITE_TOKEN_HASH_ECONOMY', await sha256Hex(inviteToken));
  vi.stubEnv('WEDDING_PASSCODE_HASH', await sha256Hex(passcode));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('invitation credentials', () => {
  it('maps only the configured opaque token and shared passcode', async () => {
    await expect(classForToken(inviteToken)).resolves.toBe('economy');
    await expect(classForToken('short')).resolves.toBeNull();
    await expect(validatePasscode(passcode)).resolves.toBe(true);
    await expect(validatePasscode('wrong-passcode')).resolves.toBe(false);
  });
});

describe('signed access token', () => {
  it('round-trips a 30-minute class-scoped bearer token', async () => {
    const access = await createAccessToken('business');
    const payload = await readAccessToken(access.token);
    expect(payload?.cabinClass).toBe('business');
    expect(payload?.scope).toBe('both-days');
    expect(payload && payload.exp - payload.iat).toBe(1800);
  });

  it('rejects tampering, expiry, and missing signing configuration', async () => {
    const access = await createAccessToken('economy');
    await expect(readAccessToken(`${access.token.slice(0, -1)}x`)).resolves.toBeNull();
    vi.advanceTimersByTime(30 * 60 * 1000);
    await expect(readAccessToken(access.token)).resolves.toBeNull();
    vi.stubEnv('SESSION_SIGNING_SECRET', '');
    await expect(readAccessToken(access.token)).resolves.toBeNull();
  });
});
