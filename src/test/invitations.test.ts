import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classForToken,
  invitationConfigurationReady,
  invitationForClass,
  sha256Hex,
  verifyPasscode,
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

  it('derives a cabin class from the URL token hash and verifies the shared passcode hash', async () => {
    const invitationToken = `economy_${'x'.repeat(24)}`;
    const passcode = `shared-${'p'.repeat(16)}`;
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex(passcode));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(invitationToken));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', '2'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));

    expect(invitationConfigurationReady()).toBe(true);
    await expect(classForToken(invitationToken)).resolves.toBe('economy');
    await expect(verifyPasscode(passcode)).resolves.toBe(true);
    await expect(verifyPasscode('incorrect')).resolves.toBe(false);
  });
});
