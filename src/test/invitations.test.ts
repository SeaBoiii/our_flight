import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accessForInvitationCode,
  accessForLegacyToken,
  classForInvitationCode,
  classForLegacyToken,
  invitationConfigurationReady,
  invitationForClass,
  legacyInvitationConfigurationReady,
  normalizeInvitationCode,
  sha256Hex,
  verifyLegacyPasscode,
} from '../invitations';
import {
  day21BrideReception,
  day21NikahAndReception,
  day22GroomReception,
} from '../programme';

afterEach(() => vi.unstubAllEnvs());

describe('static invitation configuration', () => {
  it('keeps existing groom-side class scopes unchanged', () => {
    for (const cabinClass of ['economy', 'premium-economy'] as const) {
      const invitation = invitationForClass(cabinClass);
      expect(invitation.side).toBe('groom');
      expect(invitation.scope).toBe('day22');
      expect(invitation.events.map((event) => event.id)).toEqual(['day22']);
    }
    for (const cabinClass of ['business', 'first'] as const) {
      const invitation = invitationForClass(cabinClass);
      expect(invitation.scope).toBe('both-days');
      expect(invitation.events.map((event) => event.id)).toEqual(['day21', 'day22']);
    }
  });

  it('maps bride-side classes to their approved 21 August access', () => {
    for (const cabinClass of ['economy', 'premium-economy'] as const) {
      const invitation = invitationForClass(cabinClass, 'bride');
      expect(invitation.side).toBe('bride');
      expect(invitation.scope).toBe('day21-reception');
      expect(invitation.events.map((event) => event.id)).toEqual(['day21']);
    }

    const business = invitationForClass('business', 'bride');
    expect(business.scope).toBe('day21-full');
    expect(business.events.map((event) => event.id)).toEqual(['day21']);

    const first = invitationForClass('first', 'bride');
    expect(first.scope).toBe('both-days');
    expect(first.events.map((event) => event.id)).toEqual(['day21', 'day22']);
  });

  it('keeps the three editable programmes independent and removes Nikah from reception-only data', () => {
    const [reception] = invitationForClass('economy', 'bride').events;
    const [fullDay] = invitationForClass('business', 'bride').events;
    const [groomReception] = invitationForClass('economy', 'groom').events;

    expect(reception.programme).toBe(day21BrideReception);
    expect(fullDay.programme).toBe(day21NikahAndReception);
    expect(groomReception.programme).toBe(day22GroomReception);
    expect(new Set([reception.programme, fullDay.programme, groomReception.programme]).size).toBe(3);
    expect(reception.time).toBe('12:00–16:00');
    expect(reception.segments).toHaveLength(1);
    expect(reception.calendarSegments).toHaveLength(1);
    expect(JSON.stringify(reception)).not.toMatch(/nikah/i);
    expect(JSON.stringify(fullDay)).toMatch(/nikah/i);
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
      groom: {
        economy: 'ALPHA123',
        'premium-economy': 'BRAVO456',
        business: 'CHARLIE7',
        first: 'DELTA890',
      },
      bride: {
        economy: 'ECHO1234',
        'premium-economy': 'FOXTROT5',
        business: 'GOLF6789',
        first: 'HOTEL012',
      },
    } as const;
    vi.stubEnv('VITE_INVITE_CODE_HASH_ECONOMY', await sha256Hex(codes.groom.economy));
    vi.stubEnv('VITE_INVITE_CODE_HASH_PREMIUM', await sha256Hex(codes.groom['premium-economy']));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BUSINESS', await sha256Hex(codes.groom.business));
    vi.stubEnv('VITE_INVITE_CODE_HASH_FIRST', await sha256Hex(codes.groom.first));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_ECONOMY', await sha256Hex(codes.bride.economy));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_PREMIUM', await sha256Hex(codes.bride['premium-economy']));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_BUSINESS', await sha256Hex(codes.bride.business));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_FIRST', await sha256Hex(codes.bride.first));

    expect(invitationConfigurationReady()).toBe(true);
    expect(normalizeInvitationCode('  alpha-123 ')).toBe(codes.groom.economy);
    expect(normalizeInvitationCode('ａｌｐｈａ‑１２３')).toBe(codes.groom.economy);
    await expect(classForInvitationCode('alpha − 123')).resolves.toBe('economy');
    for (const [side, sideCodes] of Object.entries(codes)) {
      for (const [cabinClass, code] of Object.entries(sideCodes)) {
        await expect(accessForInvitationCode(code)).resolves.toEqual({ side, cabinClass });
        await expect(classForInvitationCode(code)).resolves.toBe(cabinClass);
      }
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
    await expect(accessForLegacyToken(token)).resolves.toEqual({ side: 'groom', cabinClass: 'economy' });
    await expect(verifyLegacyPasscode(passcode)).resolves.toBe(true);
    await expect(verifyLegacyPasscode('incorrect')).resolves.toBe(false);

    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'false');
    expect(legacyInvitationConfigurationReady()).toBe(false);
    await expect(classForLegacyToken(token)).resolves.toBeNull();
  });
});
