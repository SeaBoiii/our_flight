import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classForInvitationCode,
  classForLegacyToken,
  invitationConfigurationReady,
  invitationForClass,
  legacyInvitationConfigurationReady,
  normalizeInvitationCode,
  sha256Hex,
  verifyLegacyPasscode,
} from '../invitations';

afterEach(() => vi.unstubAllEnvs());

describe('static invitation configuration', () => {
  it('keeps Economy and Premium to 22 August and gives Business and First both days', () => {
    for (const cabinClass of ['economy', 'premium-economy'] as const) {
      const invitation = invitationForClass(cabinClass);
      expect(invitation.scope).toBe('day22');
      expect(invitation.events.map((event) => event.id)).toEqual(['day22']);
    }
    for (const cabinClass of ['business', 'first'] as const) {
      const invitation = invitationForClass(cabinClass);
      expect(invitation.scope).toBe('both-days');
      expect(invitation.events.map((event) => event.id)).toEqual(['day21', 'day22']);
    }
  });

  it("localises the 22 August reception and accepts an edited display programme", () => {
    const [event] = invitationForClass('economy').events;
    expect(event.title).toEqual({ en: "Groom's Reception", ms: 'Walimatul Urus' });
    expect(event.segments[0].title).toEqual({ en: "Groom's Reception", ms: 'Walimatul Urus' });
    expect(event.calendarSegments[0].title).toEqual({ en: "Groom's Reception", ms: 'Walimatul Urus' });
    expect(event.programme).not.toBe(event.segments);
    expect(event.programme.length).toBeGreaterThan(0);
    for (const item of event.programme) {
      expect(item.time.trim().length).toBeGreaterThan(0);
      expect(item.title.en.trim().length).toBeGreaterThan(0);
      expect(item.title.ms.trim().length).toBeGreaterThan(0);
    }
  });

  it('normalises a readable code and derives its cabin class from the configured hash', async () => {
    const codes = {
      economy: 'ALPHA123',
      'premium-economy': 'BRAVO456',
      business: 'CHARLIE7',
      first: 'DELTA890',
    } as const;
    vi.stubEnv('VITE_INVITE_CODE_HASH_ECONOMY', await sha256Hex(codes.economy));
    vi.stubEnv('VITE_INVITE_CODE_HASH_PREMIUM', await sha256Hex(codes['premium-economy']));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BUSINESS', await sha256Hex(codes.business));
    vi.stubEnv('VITE_INVITE_CODE_HASH_FIRST', await sha256Hex(codes.first));

    expect(invitationConfigurationReady()).toBe(true);
    expect(normalizeInvitationCode('  alpha-123 ')).toBe(codes.economy);
    expect(normalizeInvitationCode('ａｌｐｈａ‑１２３')).toBe(codes.economy);
    await expect(classForInvitationCode('alpha − 123')).resolves.toBe('economy');
    for (const [cabinClass, code] of Object.entries(codes)) {
      await expect(classForInvitationCode(code)).resolves.toBe(cabinClass);
    }
    await expect(classForInvitationCode('incorrect')).resolves.toBeNull();
  });

  it('accepts old token and passcode hashes only while compatibility is enabled', async () => {
    const token = `legacy_${'x'.repeat(24)}`;
    const passcode = 'old-shared-check-in';
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'true');
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex(passcode));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(token));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', '2'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));

    expect(legacyInvitationConfigurationReady()).toBe(true);
    await expect(classForLegacyToken(token)).resolves.toBe('economy');
    await expect(verifyLegacyPasscode(passcode)).resolves.toBe(true);
    await expect(verifyLegacyPasscode('incorrect')).resolves.toBe(false);

    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'false');
    expect(legacyInvitationConfigurationReady()).toBe(false);
    await expect(classForLegacyToken(token)).resolves.toBeNull();
  });
});
