import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getCalendar } from '../app/api/v1/calendar/[day]/route';
import { GET as getInvitationRoute } from '../app/api/v1/invitation/route';
import { OPTIONS as invitationOptions } from '../app/api/v1/invitation/route';
import { POST as submitRsvpRoute } from '../app/api/v1/rsvp/route';
import { POST as unlockRoute } from '../app/api/v1/unlock/route';
import { getInvitation } from '../lib/invitation.server';
import { createAccessToken, sha256Hex } from '../lib/security.server';

const origin = 'https://guest.example';
const passcode = 'test-wedding-passcode';
const economyToken = 'economy_test_invitation_token_123456';
const businessToken = 'business_test_invitation_token_12345';

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Origin', origin);
  return new Request(`https://api.example${path}`, { ...init, headers });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-26T10:00:00+08:00'));
  vi.stubEnv('FRONTEND_ORIGIN', origin);
  vi.stubEnv('SESSION_SIGNING_SECRET', 'test-signing-secret-that-is-at-least-32-characters');
  vi.stubEnv('WEDDING_PASSCODE_HASH', await sha256Hex(passcode));
  vi.stubEnv('INVITE_TOKEN_HASH_ECONOMY', await sha256Hex(economyToken));
  vi.stubEnv('INVITE_TOKEN_HASH_BUSINESS', await sha256Hex(businessToken));
  vi.stubEnv('RSVP_STATUS', 'preview');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('server-derived invitation matrix', () => {
  it('returns one event to an economy invitation and two to a business invitation', () => {
    const economy = getInvitation('economy');
    const business = getInvitation('business');
    expect(economy.events.map((event) => event.id)).toEqual(['day22']);
    expect(business.events.map((event) => event.id)).toEqual(['day21', 'day22']);
    expect(business.events[0].segments.map((segment) => segment.time)).toEqual(['10:00 \u2013 12:00', '12:00 \u2013 16:00']);
    expect(business.events[1].time).toBe('12:00 \u2013 16:00');
    expect(economy.rsvpStatus).toBe('preview');
  });
});

describe('unlock and refresh', () => {
  it('unlocks a valid link without a cookie and refreshes with bearer authorization', async () => {
    const unlockResponse = await unlockRoute(request('/api/v1/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: economyToken, passcode }),
    }));
    expect(unlockResponse.status).toBe(200);
    expect(unlockResponse.headers.get('access-control-allow-origin')).toBe(origin);
    expect(unlockResponse.headers.get('set-cookie')).toBeNull();
    const body = await unlockResponse.json() as { accessToken: string; invitation: { events: unknown[]; rsvpStatus: string } };
    expect(body.invitation.events).toHaveLength(1);
    expect(body.invitation.rsvpStatus).toBe('preview');

    const invitationResponse = await getInvitationRoute(request('/api/v1/invitation', {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    }));
    expect(invitationResponse.status).toBe(200);
  });

  it('rejects a lookalike origin and requests without an origin', async () => {
    const access = await createAccessToken('economy');
    const lookalike = new Request('https://api.example/api/v1/invitation', {
      headers: { Origin: `${origin}.attacker.test`, Authorization: `Bearer ${access.token}` },
    });
    expect((await getInvitationRoute(lookalike)).status).toBe(403);
    const missing = new Request('https://api.example/api/v1/invitation', {
      headers: { Authorization: `Bearer ${access.token}` },
    });
    expect((await getInvitationRoute(missing)).status).toBe(403);
  });

  it('rejects path-bearing origins and preserves cache-safe preflight headers', async () => {
    const pathOrigin = new Request('https://api.example/api/v1/invitation', {
      method: 'OPTIONS',
      headers: { Origin: `${origin}/path` },
    });
    const denied = invitationOptions(pathOrigin);
    expect(denied.status).toBe(403);
    expect(denied.headers.get('vary')).toBe('Origin');
    expect(denied.headers.get('cache-control')).toBe('no-store');

    const allowed = invitationOptions(request('/api/v1/invitation', { method: 'OPTIONS' }));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('returns structured configuration and media-type failures', async () => {
    vi.stubEnv('SESSION_SIGNING_SECRET', '');
    const unavailable = await getInvitationRoute(request('/api/v1/invitation'));
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('access-control-allow-origin')).toBe(origin);

    vi.stubEnv('SESSION_SIGNING_SECRET', 'test-signing-secret-that-is-at-least-32-characters');
    const unsupported = await unlockRoute(request('/api/v1/unlock', {
      method: 'POST',
      body: JSON.stringify({ token: economyToken, passcode }),
    }));
    expect(unsupported.status).toBe(415);
  });
});

describe('scope enforcement', () => {
  it('does not expose a restricted calendar to a one-event invitation', async () => {
    const access = await createAccessToken('economy');
    const response = await getCalendar(
      request('/api/v1/calendar/day21', { headers: { Authorization: `Bearer ${access.token}` } }),
      { params: Promise.resolve({ day: 'day21' }) },
    );
    expect(response.status).toBe(404);
  });

  it('returns Singapore-time calendar data only to the matching invitation', async () => {
    const access = await createAccessToken('business');
    const response = await getCalendar(
      request('/api/v1/calendar/day21', { headers: { Authorization: `Bearer ${access.token}` } }),
      { params: Promise.resolve({ day: 'day21' }) },
    );
    expect(response.status).toBe(200);
    const ics = await response.text();
    expect(ics).toContain('DTSTART;TZID=Asia/Singapore:20270821T100000');
    expect(ics).toContain('DTEND;TZID=Asia/Singapore:20270821T160000');
    expect(ics).toContain('\r\n ');
  });

  it('keeps RSVP in honest preview mode without calling response storage', async () => {
    const access = await createAccessToken('business');
    const response = await submitRsvpRoute(request('/api/v1/rsvp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'rsvp_not_open' });
  });

  it('rejects malformed optional values instead of silently stripping them', async () => {
    vi.stubEnv('RSVP_STATUS', 'open');
    vi.stubEnv('APPS_SCRIPT_URL', 'https://script.example/exec');
    vi.stubEnv('APPS_SCRIPT_SHARED_SECRET', 'test-ingestion-secret');
    const access = await createAccessToken('business');
    const response = await submitRsvpRoute(request('/api/v1/rsvp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: '123e4567-e89b-42d3-a456-426614174000',
        locale: 'en',
        inviteeName: 'Guest',
        message: 7,
        responses: [
          { eventId: 'day21', attendance: 'not-attending', partySize: 1 },
          { eventId: 'day22', attendance: 'not-attending' },
        ],
      }),
    }));
    expect(response.status).toBe(422);
    const body = await response.json() as { fields: string[] };
    expect(body.fields).toContain('message');
    expect(body.fields).toContain('responses.day21.partySize');
  });
});
