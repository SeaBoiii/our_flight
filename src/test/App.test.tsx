import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { sha256Hex } from '../invitations';
import { saveRememberedInvitation, saveRsvpReceipt, type SavedInvitation } from '../storage';
import { copy } from '../copy';
import { experienceCopy } from '../experienceCopy';
import type { Invitation, Locale } from '../types';

const experienceState = vi.hoisted(() => ({ failed: false, lowData: false }));
vi.mock('../useLowDataMode', () => ({ useLowDataMode: () => experienceState.lowData }));

vi.mock('../components/InvitationExperience', () => ({
  default: ({ invitation, locale, entryMode, returning, onBack, onReplay, onForget, onClearDevice }: {
    invitation: Invitation;
    locale: Locale;
    entryMode: string;
    returning: boolean;
    onBack: () => void;
    onReplay: () => void;
    onForget: () => void;
    onClearDevice: () => void;
  }) => {
    if (experienceState.failed) throw new Error('Could not load invitation chunk');
    const t = experienceCopy[locale];
    return (
    <main aria-label={`${entryMode} experience`} data-returning={returning}>
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" onClick={onReplay}>{t.replay}</button>
      <button type="button" onClick={onForget}>{copy[locale].forgetInvitation}</button>
      <button type="button" onClick={onClearDevice}>{t.clearDevice}</button>
      {invitation.events.map((event) => <p key={event.id}>{event.title[locale]}</p>)}
      <a href="#rsvp">RSVP</a>
      <section id="rsvp">RSVP form</section>
    </main>
    );
  },
}));

async function rememberInvitation(overrides: Partial<SavedInvitation> = {}) {
  const saved: SavedInvitation = {
    version: 4,
    fingerprint: await sha256Hex('ALPHA123'),
    side: 'groom',
    cabinClass: 'economy',
    credential: { kind: 'class-code', value: 'ALPHA123' },
    ...overrides,
  };
  saveRememberedInvitation(saved);
  return saved;
}

async function unlockInvitation(code = 'ALPHA123') {
  const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));
  await screen.findByText(copy.en.ticketReady);
}

describe('invitation gate', () => {
  beforeEach(async () => {
    experienceState.failed = false;
    experienceState.lowData = false;
    window.history.replaceState(null, '', window.location.pathname);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.stubEnv('VITE_INVITE_CODE_HASH_ECONOMY', await sha256Hex('ALPHA123'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_PREMIUM', await sha256Hex('BRAVO456'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BUSINESS', await sha256Hex('CHARLIE7'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_FIRST', await sha256Hex('DELTA890'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_ECONOMY', await sha256Hex('ECHO1234'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_PREMIUM', await sha256Hex('FOXTROT5'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_BUSINESS', await sha256Hex('GOLF6789'));
    vi.stubEnv('VITE_INVITE_CODE_HASH_BRIDE_FIRST', await sha256Hex('HOTEL012'));
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'false');
  });

  it('uses responsive airport artwork as a decorative background without blocking check-in', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect((screen.getByLabelText('Invitation code') as HTMLInputElement).disabled).toBe(false));
    const picture = container.querySelector('.gate-background');
    const source = picture?.querySelector('source');
    const image = picture?.querySelector('img');

    expect(picture?.getAttribute('aria-hidden')).toBe('true');
    expect(source?.getAttribute('srcset')).toContain('flight/airport-landscape-1440.avif');
    expect(image?.getAttribute('src')).toContain('flight/airport-portrait-640.webp');
    expect(image?.getAttribute('alt')).toBe('');
    expect(container.querySelector('.gate-pass')).not.toBeNull();
    expect(screen.queryByText('Invitation link required')).toBeNull();
    expect((screen.getByLabelText('Invitation code') as HTMLInputElement).type).toBe('text');
  });

  it('has no manual Simple view control and ignores its retired saved preference', async () => {
    window.localStorage.setItem('our-flight:view', 'simple');
    const { container } = render(<App />);
    await waitFor(() => expect((screen.getByLabelText('Invitation code') as HTMLInputElement).disabled).toBe(false));
    expect(container.querySelector('.gate-background')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Simple view' })).toBeNull();
  });

  it('automatically avoids the airport picture for a data-saving visit', async () => {
    experienceState.lowData = true;
    const { container } = render(<App />);
    await waitFor(() => expect((screen.getByLabelText('Invitation code') as HTMLInputElement).disabled).toBe(false));
    expect(container.querySelector('.gate-background')).toBeNull();
    await unlockInvitation();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
  });

  it('unlocks from the canonical root with forgiving code formatting', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    fireEvent.change(input, { target: { value: ' alpha-123 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
    expect(window.history.state?.ourFlightEntry).toMatchObject({ view: 'boarding', position: 0 });
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.version).toBe(4);
    expect(session.credential).toEqual({ kind: 'class-code', value: 'ALPHA123' });
    expect(session.side).toBe('groom');
    expect(session.cabinClass).toBe('economy');
    expect(session.expiresAt).toBeUndefined();
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fast Track to Your Itinerary' })).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('unlocks a bride reception-only code without exposing Nikah', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    fireEvent.change(input, { target: { value: 'echo-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    expect(screen.getByText('Wedding Reception')).toBeTruthy();
    expect(screen.queryByText('Nikah')).toBeNull();
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.side).toBe('bride');
    expect(session.cabinClass).toBe('economy');
  });

  it('restores a valid remembered invitation without asking for the code again', async () => {
    const fingerprint = await sha256Hex('BRAVO456');
    window.localStorage.setItem('our-flight:access', JSON.stringify({
      version: 4,
      fingerprint,
      side: 'groom',
      cabinClass: 'premium-economy',
      credential: { kind: 'class-code', value: 'BRAVO456' },
    }));

    render(<App />);
    const itinerary = await screen.findByRole('main', { name: 'fast-track experience' });
    expect(itinerary.getAttribute('data-returning')).toBe('true');
    expect(screen.queryByLabelText('Invitation code')).toBeNull();
    expect(screen.queryByText(copy.en.ticketReady)).toBeNull();
  });

  it('opens both invited days directly while keeping both tickets accessible', async () => {
    await rememberInvitation({
      fingerprint: await sha256Hex('CHARLIE7'),
      cabinClass: 'business',
      credential: { kind: 'class-code', value: 'CHARLIE7' },
    });
    const { container } = render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    expect(screen.getByText("Nikah & Bride's Reception")).toBeTruthy();
    expect(screen.getByText("Groom's Reception")).toBeTruthy();
    expect(container.querySelectorAll('.boarding-pass')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText(copy.en.ticketReady);
    const tickets = container.querySelectorAll('.boarding-pass');
    expect(tickets).toHaveLength(2);
    expect(screen.getByRole('button', { name: experienceCopy.en.backToItinerary })).toBeTruthy();
  });

  it('personalises the returning boarding pass only from a confirmed version 2 receipt', async () => {
    const { fingerprint } = await rememberInvitation();
    saveRsvpReceipt(fingerprint, {
      version: 2,
      guestName: 'Aisha & family',
      responseId: '4f4dd805-4233-4138-8fe4-24d5a825d7cf',
      confirmedAt: '2027-07-01T10:00:00.000Z',
      responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
    });
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, JSON.stringify({
      responseId: '4f4dd805-4233-4138-8fe4-24d5a825d7cf',
      inviteeName: 'Unconfirmed draft name', message: '', responses: [],
    }));
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText(copy.en.ticketReady);
    expect(screen.getByText('Aisha & family')).toBeTruthy();
    expect(screen.queryByText('Honoured Guest')).toBeNull();
    expect(screen.queryByText('Unconfirmed draft name')).toBeNull();
  });

  it('keeps the honoured-guest label when no registered name is saved', async () => {
    const { fingerprint } = await rememberInvitation();
    saveRsvpReceipt(fingerprint, {
      version: 1,
      responseId: '4f4dd805-4233-4138-8fe4-24d5a825d7cf',
      confirmedAt: '2027-07-01T10:00:00.000Z',
      responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
    });
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText(copy.en.ticketReady);
    expect(screen.getByText('Honoured Guest')).toBeTruthy();
  });

  it('keeps event details and a way back when the invitation experience fails', async () => {
    await rememberInvitation();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    experienceState.failed = true;
    render(<App />);
    const heading = await screen.findByRole('heading', { name: copy.en.experienceUnavailable });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('alert').textContent).toBe(copy.en.experienceUnavailableBody);
    expect(screen.getByText('AN2208')).toBeTruthy();
    expect(screen.queryByText('AN2108')).toBeNull();
    expect(screen.getByText('Sunday, 22 August 2027')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Get directions/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.en.reloadInvitation })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.en.back }));
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).not.toBeNull();
  });

  it('supports older media-query listeners and cleans them up', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addListener, removeListener } as unknown as MediaQueryList);
    const { unmount } = render(<App />);
    expect(addListener).toHaveBeenCalledOnce();
    unmount();
    expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0][0]);
  });

  it('clears a v3 session without deleting its fingerprint-keyed RSVP draft', async () => {
    const fingerprint = await sha256Hex('ALPHA123');
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      fingerprint,
      cabinClass: 'economy',
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');

    render(<App />);
    await waitFor(() => expect(window.sessionStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it.each([
    { side: 'bride', cabinClass: 'economy' },
    { side: 'groom', cabinClass: 'business' },
  ])('rejects a saved session whose verified side or class was changed', async ({ side, cabinClass }) => {
    const fingerprint = await sha256Hex('ALPHA123');
    window.localStorage.setItem('our-flight:access', JSON.stringify({
      version: 4,
      fingerprint,
      side,
      cabinClass,
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');

    render(<App />);
    await waitFor(() => expect(window.localStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it('restores months later without expiring or deleting the RSVP draft', async () => {
    const { fingerprint } = await rememberInvitation();
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 180 * 24 * 60 * 60_000);

    render(<App />);
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).not.toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it('shows the ticket on a first visit and opens the itinerary when the invitation returns', async () => {
    const firstVisit = render(<App />);
    await unlockInvitation();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
    firstVisit.unmount();

    render(<App />);
    expect((await screen.findByRole('main', { name: 'fast-track experience' })).getAttribute('data-returning')).toBe('true');
    expect(screen.queryByLabelText('Invitation code')).toBeNull();
  });

  describe('wedding-day boarding shortcut', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens the itinerary directly from a first-visit boarding pass on the event day', async () => {
      vi.setSystemTime(new Date('2027-08-22T13:00:00+08:00'));
      const { container } = render(<App />);
      await unlockInvitation();

      const shortcut = screen.getByRole('button', { name: 'Skip to today’s details' });
      expect(shortcut.classList.contains('boarding-skip-today')).toBe(true);
      expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
      fireEvent.click(shortcut);

      expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
      expect(window.history.state?.ourFlightEntry).toMatchObject({ view: 'fast-track', position: 1 });
      expect(container.querySelector('.boarding-page')).toBeNull();
      expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();
    });

    it('does not offer the shortcut before the wedding', async () => {
      vi.setSystemTime(new Date('2027-08-20T13:00:00+08:00'));
      const { container } = render(<App />);
      await unlockInvitation();

      expect(screen.queryByRole('button', { name: 'Skip to today’s details' })).toBeNull();
      expect(container.querySelector('.boarding-skip-today')).toBeNull();
      expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
    });
  });

  it('scans the first-visit ticket and returns from the journey to that ticket', async () => {
    render(<App />);
    await unlockInvitation();
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tap ticket to scan and board' }));
    expect(await screen.findByRole('main', { name: 'journey experience' }, { timeout: 2000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    await waitFor(() => expect(window.history.state?.ourFlightEntry).toMatchObject({ view: 'boarding', position: 0 }));
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
    window.history.forward();
    expect(await screen.findByRole('main', { name: 'journey experience' })).toBeTruthy();
    window.history.back();
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
  });

  it('preserves the returning itinerary and keepsake through browser back and forward', async () => {
    await rememberInvitation();
    render(<App />);
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    window.history.back();
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.forward();
    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: experienceCopy.en.backToItinerary }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(0));
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
  });

  it('allows a returning guest to replay directly and return to the itinerary through Back and Forward', async () => {
    await rememberInvitation();
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('button', { name: experienceCopy.en.replay }));
    expect(await screen.findByRole('main', { name: 'journey experience' }, { timeout: 2000 })).toBeTruthy();
    window.history.back();
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.forward();
    expect(await screen.findByRole('main', { name: 'journey experience' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(0));
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
  });

  it('keeps native section-link history and returns past anchors from the keepsake to the itinerary', async () => {
    await rememberInvitation();
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('link', { name: 'RSVP' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(1));
    expect(window.location.hash).toBe('#rsvp');
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.back();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(0));
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.forward();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.view).toBe('boarding'));
    fireEvent.click(screen.getByRole('button', { name: experienceCopy.en.backToItinerary }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(0));
    expect(window.location.hash).toBe('');
    window.history.forward();
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();
  });

  it.each(['boarding', 'experience'])('switches invitations from %s while preserving drafts', async (view) => {
    const { fingerprint } = await rememberInvitation();
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    if (view === 'boarding') {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      await screen.findByText(copy.en.ticketReady);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Use a different invitation' }));
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
    await unlockInvitation('ECHO1234');
    expect(screen.getByText('Wedding Reception')).toBeTruthy();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
  });

  it('can clear saved access, drafts and receipts on the device without clearing unrelated preferences', async () => {
    const { fingerprint } = await rememberInvitation();
    for (const target of [window.localStorage, window.sessionStorage]) {
      target.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');
      target.setItem(`our-flight:receipt:${fingerprint}`, '{"received":true}');
      target.setItem('our-flight:rsvp:another-invitation', '{"saved":true}');
      target.setItem('unrelated-app-data', 'keep');
    }
    window.localStorage.setItem('our-flight:view', 'simple');
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('button', { name: experienceCopy.en.clearDevice }));
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    for (const target of [window.localStorage, window.sessionStorage]) {
      expect(target.getItem('our-flight:access')).toBeNull();
      expect(target.getItem(`our-flight:rsvp:${fingerprint}`)).toBeNull();
      expect(target.getItem(`our-flight:receipt:${fingerprint}`)).toBeNull();
      expect(target.getItem('our-flight:rsvp:another-invitation')).toBeNull();
      expect(target.getItem('unrelated-app-data')).toBe('keep');
    }
    expect(window.localStorage.getItem('our-flight:view')).toBe('simple');
    await unlockInvitation();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
  });

  it('does not reopen a forgotten invitation through browser history after switching', async () => {
    await rememberInvitation();
    render(<App />);
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('button', { name: experienceCopy.en.replay }));
    await screen.findByRole('main', { name: 'journey experience' });
    fireEvent.click(screen.getByRole('link', { name: 'RSVP' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(2));
    const previousVisit = window.history.state.ourFlightEntry.visit;
    fireEvent.click(screen.getByRole('button', { name: 'Use a different invitation' }));
    window.history.back();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.visit).toBe(previousVisit));
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
    await unlockInvitation('ECHO1234');
    window.history.back();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.visit).toBe(previousVisit));
    expect(screen.getByText('Wedding Reception')).toBeTruthy();
    expect(screen.getAllByText('AN2108').length).toBeGreaterThan(0);
    expect(screen.queryByText('AN2208')).toBeNull();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
    window.history.forward();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.visit).not.toBe(previousVisit));
    expect(screen.getByText('Wedding Reception')).toBeTruthy();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
  });

  it('localises returning-guest actions in Malay', async () => {
    await rememberInvitation();
    window.localStorage.setItem('our-flight:language', 'ms');
    render(<App />);
    expect(await screen.findByRole('button', { name: experienceCopy.ms.replay })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gunakan jemputan lain' })).toBeTruthy();
  });

  it.each(['credential', 'fingerprint', 'configuration'])('rejects a remembered invitation after %s changes', async (change) => {
    const { fingerprint } = await rememberInvitation(change === 'fingerprint' ? { fingerprint: 'f'.repeat(64) } : {});
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');
    if (change === 'credential') vi.stubEnv('VITE_INVITE_CODE_HASH_ECONOMY', await sha256Hex('REPLACED8'));
    if (change === 'configuration') vi.stubEnv('VITE_INVITE_CODE_HASH_FIRST', '');
    render(<App />);
    await waitFor(() => expect(window.localStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it('allows the current visit when persistent storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    render(<App />);
    await unlockInvitation();
    expect(screen.getByText(copy.en.ticketReady)).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
  });

  it('allows check-in and navigation when browser storage getters are blocked', async () => {
    const blockedStorage = () => { throw new DOMException('Blocked', 'SecurityError'); };
    const localStorage = vi.spyOn(window, 'localStorage', 'get').mockImplementation(blockedStorage);
    const sessionStorage = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(blockedStorage);
    try {
      render(<App />);
      await unlockInvitation();
      fireEvent.click(screen.getByRole('button', { name: copy.en.scanTicket }));
      expect(await screen.findByRole('main', { name: 'journey experience' }, { timeout: 2000 })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
      await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(0));
    } finally {
      localStorage.mockRestore();
      sessionStorage.mockRestore();
    }
  });

  it('uses a generic error for an unknown code', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: 'UNKNOWN88' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));
    expect((await screen.findByRole('alert')).textContent).toContain('We could not verify this invitation code.');
  });

  it('does not commit a code unlock after navigation changes the access flow', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    let releaseDigest!: () => void;
    let completedDigests = 0;
    const digestGate = new Promise<void>((resolve) => { releaseDigest = resolve; });
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      await digestGate;
      const result = await originalDigest(algorithm, data);
      completedDigests += 1;
      return result;
    });

    fireEvent.change(input, { target: { value: 'ALPHA123' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));
    window.location.hash = `#/i/${'n'.repeat(24)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    releaseDigest();

    await waitFor(() => expect(completedDigests).toBe(2));
    expect(screen.queryByText('Your boarding pass is ready.')).toBeNull();
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('removes an old hash link when compatibility is disabled', async () => {
    window.location.hash = `#/i/${'z'.repeat(24)}`;
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
  });

  it('rejects a stale legacy session when compatibility is disabled', async () => {
    const token = `legacy_${'s'.repeat(24)}`;
    window.localStorage.setItem('our-flight:access', JSON.stringify({
      version: 4,
      fingerprint: await sha256Hex(token),
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'legacy-token', value: token },
    }));

    render(<App />);
    await waitFor(() => expect(window.localStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
  });

  it('keeps a valid remembered class invitation when a disabled legacy link is opened', async () => {
    await rememberInvitation();
    window.location.hash = `#/i/${'z'.repeat(24)}`;
    render(<App />);
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem('our-flight:access')).not.toBeNull();
  });

  it('restores a verified legacy invitation only while compatibility is enabled', async () => {
    const token = `legacy_${'q'.repeat(24)}`;
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'true');
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex('old-shared-check-in'));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(token));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', '2'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));
    await rememberInvitation({
      fingerprint: await sha256Hex(token),
      credential: { kind: 'legacy-token', value: token },
    });
    render(<App />);
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(screen.getByText('Wedding Reception')).toBeTruthy();
  });

  it('accepts an old shared passcode during transition and then removes the fragment', async () => {
    const token = `legacy_${'q'.repeat(24)}`;
    const passcode = 'old-shared-check-in';
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'true');
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex(passcode));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(token));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', '2'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));
    window.location.hash = `#/i/${token}`;

    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: passcode } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    expect(window.location.hash).toBe('');
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.side).toBe('groom');
    expect(session.credential).toEqual({ kind: 'legacy-token', value: token });
  });

  it('does not replace a newly opened legacy link with a remembered invitation from another link', async () => {
    const rememberedToken = `legacy_${'a'.repeat(24)}`;
    const incomingToken = `legacy_${'b'.repeat(24)}`;
    const passcode = 'old-shared-check-in';
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'true');
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex(passcode));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(rememberedToken));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', await sha256Hex(incomingToken));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));
    window.localStorage.setItem('our-flight:access', JSON.stringify({
      version: 4,
      fingerprint: await sha256Hex(rememberedToken),
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'legacy-token', value: rememberedToken },
    }));
    window.location.hash = `#/i/${incomingToken}`;

    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: passcode } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText(copy.en.ticketReady)).toBeTruthy();
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.cabinClass).toBe('premium-economy');
    expect(session.credential.value).toBe(incomingToken);
  });
});
