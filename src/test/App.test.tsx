import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { sha256Hex } from '../invitations';

describe('invitation gate', () => {
  beforeEach(async () => {
    window.location.hash = '';
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
    const submittedAt = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    const session = JSON.parse(window.sessionStorage.getItem('our-flight:access') ?? '{}');
    expect(session.version).toBe(3);
    expect(session.credential).toEqual({ kind: 'class-code', value: 'ALPHA123' });
    expect(session.side).toBe('groom');
    expect(session.cabinClass).toBe('economy');
    expect(Date.parse(session.expiresAt) - submittedAt).toBeGreaterThanOrEqual(30 * 60_000 - 1_000);
    expect(Date.parse(session.expiresAt) - submittedAt).toBeLessThanOrEqual(30 * 60_000 + 1_000);
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
    const session = JSON.parse(window.sessionStorage.getItem('our-flight:access') ?? '{}');
    expect(session.side).toBe('bride');
    expect(session.cabinClass).toBe('economy');
  });

  it('restores a valid class-code session without asking for the code again', async () => {
    const fingerprint = await sha256Hex('BRAVO456');
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      fingerprint,
      side: 'groom',
      cabinClass: 'premium-economy',
      credential: { kind: 'class-code', value: 'BRAVO456' },
    }));

    render(<App />);
    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    expect(screen.queryByLabelText('Invitation code')).toBeNull();
  });

  it('clears a pre-v3 session without deleting its fingerprint-keyed RSVP draft', async () => {
    const fingerprint = await sha256Hex('ALPHA123');
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 2,
      unlocked: true,
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
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      fingerprint,
      side,
      cabinClass,
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');

    render(<App />);
    await waitFor(() => expect(window.sessionStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
  });

  it('expires an old class-code session without deleting its RSVP draft', async () => {
    const fingerprint = await sha256Hex('ALPHA123');
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      fingerprint,
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'class-code', value: 'ALPHA123' },
    }));
    window.localStorage.setItem(`our-flight:rsvp:${fingerprint}`, '{"saved":true}');

    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain('session has expired');
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
    expect(window.localStorage.getItem(`our-flight:rsvp:${fingerprint}`)).toBe('{"saved":true}');
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
    expect(window.sessionStorage.getItem('our-flight:access')).toBeNull();
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
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      fingerprint: await sha256Hex(token),
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'legacy-token', value: token },
    }));

    render(<App />);
    await waitFor(() => expect(window.sessionStorage.getItem('our-flight:access')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Invitation check‑in' })).toBeTruthy();
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
    const session = JSON.parse(window.sessionStorage.getItem('our-flight:access') ?? '{}');
    expect(session.side).toBe('groom');
    expect(session.credential).toEqual({ kind: 'legacy-token', value: token });
  });

  it('does not replace a newly opened legacy link with an expired session from another link', async () => {
    const expiredToken = `legacy_${'a'.repeat(24)}`;
    const incomingToken = `legacy_${'b'.repeat(24)}`;
    const passcode = 'old-shared-check-in';
    vi.stubEnv('VITE_LEGACY_INVITES_ENABLED', 'true');
    vi.stubEnv('VITE_PASSCODE_HASH', await sha256Hex(passcode));
    vi.stubEnv('VITE_INVITE_HASH_ECONOMY', await sha256Hex(expiredToken));
    vi.stubEnv('VITE_INVITE_HASH_PREMIUM', await sha256Hex(incomingToken));
    vi.stubEnv('VITE_INVITE_HASH_BUSINESS', '3'.repeat(64));
    vi.stubEnv('VITE_INVITE_HASH_FIRST', '4'.repeat(64));
    window.sessionStorage.setItem('our-flight:access', JSON.stringify({
      version: 3,
      unlocked: true,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      fingerprint: await sha256Hex(expiredToken),
      side: 'groom',
      cabinClass: 'economy',
      credential: { kind: 'legacy-token', value: expiredToken },
    }));
    window.location.hash = `#/i/${incomingToken}`;

    render(<App />);
    const input = screen.getByLabelText('Invitation code') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: passcode } });
    fireEvent.click(screen.getByRole('button', { name: 'View invitation' }));

    expect(await screen.findByText('Your boarding pass is ready.')).toBeTruthy();
    const session = JSON.parse(window.sessionStorage.getItem('our-flight:access') ?? '{}');
    expect(session.cabinClass).toBe('premium-economy');
    expect(session.credential.value).toBe(incomingToken);
  });
});
