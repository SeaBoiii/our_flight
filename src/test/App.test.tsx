import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { sha256Hex } from '../invitations';
import { saveRememberedInvitation, type SavedInvitation } from '../storage';

vi.mock('../components/InvitationExperience', () => ({
  default: ({ entryMode, onBack, onForget }: { entryMode: string; onBack: () => void; onForget: () => void }) => (
    <main aria-label={`${entryMode} experience`}>
      <button type="button" onClick={onBack}>Back to boarding pass</button>
      <button type="button" onClick={onForget}>Use a different invitation</button>
      <a href="#rsvp">RSVP</a>
      <section id="rsvp">RSVP form</section>
    </main>
  ),
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
  await screen.findByText('Your boarding pass is ready.');
}

describe('invitation gate', () => {
  beforeEach(async () => {
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

  it('uses responsive Changi artwork as a decorative background', () => {
    const { container } = render(<App />);
    const picture = container.querySelector('.gate-background');
    const source = picture?.querySelector('source');
    const image = picture?.querySelector('img');

    expect(picture?.getAttribute('aria-hidden')).toBe('true');
    expect(source?.getAttribute('srcset')).toContain('gate/changi-jewel-landscape.webp');
    expect(image?.getAttribute('src')).toContain('gate/changi-jewel-portrait.webp');
    expect(image?.getAttribute('alt')).toBe('');
    expect(container.querySelector('.gate-pass')).not.toBeNull();
    expect(screen.queryByText('Invitation link required')).toBeNull();
    expect((screen.getByLabelText('Invitation code') as HTMLInputElement).type).toBe('text');
  });

  it('unlocks from the canonical root with forgiving code formatting', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    fireEvent.change(input, { target: { value: ' alpha-123 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.version).toBe(4);
    expect(session.credential).toEqual({ kind: 'class-code', value: 'ALPHA123' });
    expect(session.side).toBe('groom');
    expect(session.cabinClass).toBe('economy');
    expect(session.expiresAt).toBeUndefined();
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('unlocks a bride reception-only code without exposing Nikah', async () => {
    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    fireEvent.change(input, { target: { value: 'echo-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
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
    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    expect(screen.queryByLabelText('Invitation code')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
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
    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).not.toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it('offers Fast Track only after the manually unlocked invitation is reopened', async () => {
    const firstVisit = render(<App />);
    await unlockInvitation();
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
    firstVisit.unmount();

    render(<App />);
    expect(await screen.findByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
    expect(screen.queryByLabelText('Invitation code')).toBeNull();
  });

  it('keeps first-unlock Fast Track hidden after scanning and returning to the ticket', async () => {
    render(<App />);
    await unlockInvitation();
    fireEvent.click(screen.getByRole('button', { name: 'Tap ticket to scan and board' }));
    expect(await screen.findByRole('main', { name: 'journey experience' }, { timeout: 2000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to boarding pass' }));
    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.view).toBe('boarding'));
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
  });

  it('preserves Fast Track mode through browser back and forward', async () => {
    await rememberInvitation();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fast Track to Flight Details' }));
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();

    window.history.back();
    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
    window.history.forward();
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();
  });

  it('allows a returning guest to replay the full journey', async () => {
    await rememberInvitation();
    render(<App />);
    await screen.findByRole('button', { name: 'Fast Track to Flight Details' });
    fireEvent.click(screen.getByRole('button', { name: 'Tap ticket to scan and board' }));
    expect(await screen.findByRole('main', { name: 'journey experience' }, { timeout: 2000 })).toBeTruthy();
  });

  it('keeps section-link history in Fast Track and returns past anchors to the boarding pass', async () => {
    await rememberInvitation();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fast Track to Flight Details' }));
    await screen.findByRole('main', { name: 'fast-track experience' });
    fireEvent.click(screen.getByRole('link', { name: 'RSVP' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(2));
    expect(window.location.hash).toBe('#rsvp');
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.back();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(1));
    expect(screen.getByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    window.history.forward();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.position).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Back to boarding pass' }));
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.view).toBe('boarding'));
    expect(screen.getByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    window.history.forward();
    expect(await screen.findByRole('main', { name: 'fast-track experience' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'journey experience' })).toBeNull();
  });

  it.each(['boarding', 'experience'])('forgets from %s, preserves drafts, and resets first-unlock behaviour', async (view) => {
    const { fingerprint } = await rememberInvitation();
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');
    render(<App />);
    const fastTrack = await screen.findByRole('button', { name: 'Fast Track to Flight Details' });
    if (view === 'experience') {
      fireEvent.click(fastTrack);
      await screen.findByRole('main', { name: 'fast-track experience' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Use a different invitation' }));
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
    await unlockInvitation('ECHO1234');
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
  });

  it('does not reopen a forgotten invitation through browser history after switching', async () => {
    await rememberInvitation();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fast Track to Flight Details' }));
    await screen.findByRole('main', { name: 'fast-track experience' });
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
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(screen.queryByText("Groom's Reception")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
    window.history.forward();
    await waitFor(() => expect(window.history.state?.ourFlightEntry?.visit).not.toBe(previousVisit));
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'fast-track experience' })).toBeNull();
  });

  it('localises returning-guest actions in Malay', async () => {
    await rememberInvitation();
    window.localStorage.setItem('our-flight:language', 'ms');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Laluan Pantas ke Butiran Majlis' })).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: 'Fast Track to Flight Details' })).toBeNull();
    expect(window.localStorage.getItem('our-flight:access')).toBeNull();
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
    expect(await screen.findByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
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
    expect(await screen.findByRole('button', { name: 'Fast Track to Flight Details' })).toBeTruthy();
    expect(screen.getByText("Groom's Reception")).toBeTruthy();
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

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
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

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    const session = JSON.parse(window.localStorage.getItem('our-flight:access') ?? '{}');
    expect(session.cabinClass).toBe('premium-economy');
    expect(session.credential.value).toBe(incomingToken);
  });
});
