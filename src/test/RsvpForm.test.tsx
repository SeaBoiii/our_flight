import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { RsvpForm } from '../components/RsvpForm';
import { invitationForClass } from '../invitations';
import { readDraft, saveDraft } from '../storage';
import type { Invitation, Locale } from '../types';
import { invitationWith } from './fixtures';

describe('RSVP preview mode', () => {
  it('shows the complete form while preventing a fake submission', () => {
    render(
      <RsvpForm
        invitation={invitationWith()}
        accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
        fingerprint="preview-fingerprint"
        locale="en"
      />,
    );
    expect(screen.getByText('RSVP preview')).toBeTruthy();
    expect(screen.getByText('Will you attend the wedding ceremony?')).toBeTruthy();
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the same wedding-ceremony question separately for each invited day', () => {
    render(
      <RsvpForm
        invitation={invitationWith(2)}
        accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
        fingerprint="both-days-fingerprint"
        locale="en"
      />,
    );
    expect(screen.getAllByText('Will you attend the wedding ceremony?')).toHaveLength(2);
    expect(screen.getByText('Saturday, 21 August 2027')).toBeTruthy();
    expect(screen.getByText('Sunday, 22 August 2027')).toBeTruthy();
  });

  it('describes a reception-only response without mentioning Nikah', () => {
    const { container } = render(
      <RsvpForm
        invitation={invitationForClass('economy', 'bride')}
        accessCredential={{ kind: 'class-code', value: 'ECHO1234' }}
        fingerprint="bride-reception-fingerprint"
        locale="en"
      />,
    );

    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(container.textContent).not.toMatch(/nikah/i);
  });

  it('shows linked validation errors before any open RSVP request is sent', () => {
    const invitation = invitationWith(1, 'open');
    render(
      <RsvpForm
        invitation={invitation}
        accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
        fingerprint="open-fingerprint"
        locale="en"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter your name.');
    expect(screen.getByRole('link', { name: 'Enter your name.' }).getAttribute('href')).toBe('#invitee-name');
    expect(screen.getByRole('link', { name: 'Select an attendance response.' }).getAttribute('href')).toBe('#attendance-0-yes');
  });
});

function openForm(invitation = invitationWith(1, 'open'), locale: Locale = 'en') {
  return render(
    <RsvpForm
      invitation={invitation}
      accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
      fingerprint="confirmation-fingerprint"
      locale={locale}
    />,
  );
}

function completeResponse(attendance: Array<'attending' | 'not-attending'>, locale: Locale = 'en') {
  fireEvent.change(screen.getByLabelText(locale === 'en' ? 'Your name' : 'Nama anda'), { target: { value: 'Aminah Rahman' } });
  attendance.forEach((value, index) => {
    fireEvent.click(document.getElementById(`attendance-${index}-${value === 'attending' ? 'yes' : 'no'}`)!);
    if (value === 'attending') {
      fireEvent.change(document.getElementById(`party-size-${index}`)!, { target: { value: String(index + 2) } });
    }
  });
}

describe('RSVP flight confirmation', () => {
  it('replaces an attending form with submitted guest, event and venue details after a verified receipt', async () => {
    const submit = vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    const invitation = invitationWith(1, 'open');
    openForm(invitation);
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    const heading = await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('status').textContent).toContain('We look forward to having you on board');
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.getByText('Aminah Rahman')).toBeTruthy();
    expect(screen.getByText('AN2208')).toBeTruthy();
    expect(screen.queryByText('AN2108')).toBeNull();
    expect(screen.getByText('Sunday, 22 August 2027')).toBeTruthy();
    expect(screen.getByText('12:00-16:00')).toBeTruthy();
    expect(screen.getByText('Economy')).toBeTruthy();
    expect(screen.getByText('Crowne Plaza at Changi Airport')).toBeTruthy();
    expect(screen.getByText('Chengal Ballroom · Terminal 3')).toBeTruthy();
    expect(screen.getByText('Number attending, including you:').textContent).toContain('2');
    expect(readDraft('confirmation-fingerprint')).toBeNull();
    expect(submit.mock.calls[0][2].responseId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(screen.getByRole('link', { name: 'Add to calendar' }).getAttribute('href'))
      .toBe('/calendar/aleem-nurulain-day22-en.ics');
  });

  it('confirms both invited events and keeps their party sizes distinct', async () => {
    vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    openForm(invitationWith(2, 'open'));
    completeResponse(['attending', 'attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    const events = screen.getAllByRole('article');
    expect(events).toHaveLength(2);
    expect(within(events[0]).getByText('Number attending, including you:').textContent).toContain('2');
    expect(within(events[1]).getByText('Number attending, including you:').textContent).toContain('3');
    expect(screen.getAllByRole('link', { name: 'Add to calendar' }).map((link) => link.getAttribute('href')))
      .toEqual(['/calendar/aleem-nurulain-day21-full-en.ics', '/calendar/aleem-nurulain-day22-en.ics']);
  });

  it('shows a warm successful decline with no calendar actions or party size', async () => {
    vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    const { container } = openForm(invitationWith(2, 'open'));
    completeResponse(['not-attending', 'not-attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByRole('heading', { name: "We'll miss having you on board" });
    expect(screen.getByRole('status').textContent).toContain('Thank you for responding');
    expect(screen.getAllByText('Unable to attend')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Add to calendar' })).toBeNull();
    expect(screen.queryByText('Number attending, including you:')).toBeNull();
    expect(container.querySelector('.submission-status--failed')).toBeNull();
    expect(readDraft('confirmation-fingerprint')).toBeNull();
  });

  it('shows mixed attendance by event and adds only the attended event to the calendar', async () => {
    vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: true });
    const invitation = invitationWith(2, 'open');
    openForm(invitation);
    completeResponse(['attending', 'not-attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByRole('heading', { name: 'Your itinerary is confirmed' });
    const events = screen.getAllByRole('article');
    expect(within(events[0]).getByText('Attending')).toBeTruthy();
    expect(within(events[1]).getByText('Unable to attend')).toBeTruthy();
    expect(within(events[1]).queryByRole('link', { name: 'Add to calendar' })).toBeNull();
    expect(screen.getByText('This RSVP was already received. No duplicate response was created.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add to calendar' }).getAttribute('href'))
      .toBe('/calendar/aleem-nurulain-day21-full-en.ics');
    expect(readDraft('confirmation-fingerprint')).toBeNull();
  });

  it('retains bride reception scope and translates a duplicate-confirmed response into Malay', async () => {
    vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: true });
    const invitation: Invitation = { ...invitationForClass('economy', 'bride'), rsvpStatus: 'open' };
    const { container } = openForm(invitation, 'ms');
    completeResponse(['attending'], 'ms');
    fireEvent.click(screen.getByRole('button', { name: 'Hantar RSVP' }));

    await screen.findByRole('heading', { name: 'Tempat anda telah disahkan' });
    expect(screen.getByText('Resepsi Pengantin Perempuan')).toBeTruthy();
    expect(screen.getByText('AN2108')).toBeTruthy();
    expect(screen.queryByText('AN2208')).toBeNull();
    expect(container.textContent).not.toMatch(/nikah/i);
    expect(screen.getByText('Kelas Ekonomi')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tambah ke kalendar' }).getAttribute('href'))
      .toBe('/calendar/aleem-nurulain-day21-reception-ms.ics');
    expect(screen.getByText('RSVP ini telah diterima sebelum ini. Tiada jawapan pendua direkodkan.')).toBeTruthy();
  });

  it('waits for receipt, blocks parallel submits and confirms the submitted snapshot when locale changes', async () => {
    let receive!: (receipt: Awaited<ReturnType<typeof api.submitRsvp>>) => void;
    const submit = vi.spyOn(api, 'submitRsvp').mockImplementation(() => new Promise((resolve) => { receive = resolve; }));
    const invitation = invitationWith(1, 'open');
    const { container, rerender } = openForm(invitation);
    completeResponse(['attending']);
    const originalId = readDraft('confirmation-fingerprint')?.responseId;
    fireEvent.submit(container.querySelector('form')!);
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Your seat is confirmed' })).toBeNull();
    expect(readDraft('confirmation-fingerprint')?.responseId).toBe(originalId);
    rerender(<RsvpForm invitation={invitation} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="confirmation-fingerprint" locale="ms" />);
    await act(async () => receive({ ok: true, duplicate: false }));

    expect(screen.getByRole('heading', { name: 'Tempat anda telah disahkan' })).toBeTruthy();
    expect(screen.getByText('Aminah Rahman')).toBeTruthy();
    expect(submit.mock.calls[0][1]).toBe('en');
    expect(submit.mock.calls[0][2].responseId).toBe(originalId);
    expect(readDraft('confirmation-fingerprint')).toBeNull();
  });

  it('preserves answers and response ID after an unconfirmed attempt and accepts a duplicate on retry', async () => {
    const submit = vi.spyOn(api, 'submitRsvp')
      .mockRejectedValueOnce(new api.ApiFailure(0, 'unconfirmed'))
      .mockResolvedValueOnce({ ok: true, duplicate: true });
    openForm();
    completeResponse(['attending']);
    const saved = readDraft('confirmation-fingerprint');
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByText(/We could not confirm whether your RSVP reached us/);
    expect(screen.queryByRole('heading', { name: 'Your seat is confirmed' })).toBeNull();
    expect(readDraft('confirmation-fingerprint')).toEqual({ ...saved, submissionLocale: 'en' });
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    expect(submit.mock.calls[1][2]).toEqual(submit.mock.calls[0][2]);
    expect(screen.getByText('This RSVP was already received. No duplicate response was created.')).toBeTruthy();
  });

  it('keeps idempotency conflicts editable until the guest explicitly clears the saved response', async () => {
    vi.spyOn(api, 'submitRsvp').mockRejectedValue(new api.ApiFailure(422, 'idempotency_conflict'));
    openForm();
    completeResponse(['attending']);
    const saved = readDraft('confirmation-fingerprint');
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByText(/This saved response ID was already used for different answers/);
    expect(readDraft('confirmation-fingerprint')).toEqual({ ...saved, submissionLocale: 'en' });
    expect(screen.queryByRole('heading', { name: 'Your seat is confirmed' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear saved response' }));
    expect(readDraft('confirmation-fingerprint')).toBeNull();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Aminah' } });
    expect(readDraft('confirmation-fingerprint')?.responseId).not.toBe(saved?.responseId);
    expect(readDraft('confirmation-fingerprint')?.submissionLocale).toBeUndefined();
  });

  it('continues showing server field errors without clearing the submitted draft', async () => {
    vi.spyOn(api, 'submitRsvp').mockRejectedValue(new api.ApiFailure(422, 'invalid_fields', ['responses.day22.partySize']));
    openForm();
    completeResponse(['attending']);
    const saved = readDraft('confirmation-fingerprint');
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    const error = await screen.findByRole('alert');
    expect(within(error).getByRole('link', { name: 'Enter a whole number of 1 or more.' }).getAttribute('href')).toBe('#party-size-0');
    expect(readDraft('confirmation-fingerprint')).toEqual({ ...saved, submissionLocale: 'en' });
    expect(screen.queryByRole('heading', { name: 'Your seat is confirmed' })).toBeNull();
  });
});

describe('RSVP recovery and validation', () => {
  it.each([false, true])('preserves the original submission language on retry after switching locale (reopen: %s)', async (reopen) => {
    const submit = vi.spyOn(api, 'submitRsvp')
      .mockRejectedValueOnce(new api.ApiFailure(0, 'unconfirmed'))
      .mockResolvedValueOnce({ ok: true, duplicate: true });
    const invitation = invitationWith(1, 'open');
    const { rerender, unmount } = openForm(invitation);
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByText(/We could not confirm whether your RSVP reached us/);
    if (reopen) {
      unmount();
      openForm(invitation, 'ms');
    } else {
      rerender(<RsvpForm invitation={invitation} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="confirmation-fingerprint" locale="ms" />);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Hantar RSVP' }));
    await screen.findByRole('heading', { name: 'Tempat anda telah disahkan' });
    expect(submit.mock.calls.map((call) => call[1])).toEqual(['en', 'en']);
    expect(submit.mock.calls[1][2]).toEqual(submit.mock.calls[0][2]);
  });

  it('ignores corrupt stored answers and allows a fresh response', () => {
    window.localStorage.setItem('our-flight:rsvp:confirmation-fingerprint', JSON.stringify({
      responseId: '123e4567-e89b-42d3-a456-426614174000', inviteeName: 'Guest', message: '', responses: [null],
    }));
    openForm();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
    completeResponse(['attending']);
    expect(readDraft('confirmation-fingerprint')?.responses[0].attendance).toBe('attending');
  });

  it('restores answers and the same response ID after leaving and reopening the form', () => {
    const { unmount } = openForm();
    completeResponse(['attending']);
    fireEvent.change(screen.getByLabelText('Message for Aleem & Nurulain (optional)'), { target: { value: 'See you soon!' } });
    const saved = readDraft('confirmation-fingerprint');
    unmount();
    openForm();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Aminah Rahman');
    expect((document.getElementById('party-size-0') as HTMLInputElement).value).toBe('2');
    expect(readDraft('confirmation-fingerprint')).toEqual(saved);
  });

  it('clears corrected field errors and removes party errors when declining', () => {
    openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest' } });
    expect(screen.queryByText('Enter your name.')).toBeNull();
    fireEvent.click(document.getElementById('attendance-0-yes')!);
    expect(screen.queryByText('Select an attendance response.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    expect(screen.getByRole('link', { name: 'Enter a whole number of 1 or more.' })).toBeTruthy();
    fireEvent.click(document.getElementById('attendance-0-no')!);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.getElementById('party-size-0')).toBeNull();
  });

  it('translates existing errors when the language changes', () => {
    const invitation = invitationWith(1, 'open');
    const { rerender } = openForm(invitation);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    rerender(<RsvpForm invitation={invitation} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="confirmation-fingerprint" locale="ms" />);
    expect(screen.queryByText('Enter your name.')).toBeNull();
    expect(screen.getByRole('link', { name: 'Masukkan nama anda.' })).toBeTruthy();
  });

  it('keeps submission usable and explains when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    const submit = vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    openForm();
    completeResponse(['attending']);
    expect(screen.getByText(/this browser could not save them/)).toBeTruthy();
    expect(screen.queryByText(/unfinished response is saved on this device/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    expect(submit.mock.calls[0][2].inviteeName).toBe('Aminah Rahman');
  });

  it('aborts a departed form and prevents its late receipt from erasing a newer draft', async () => {
    let receive!: (receipt: Awaited<ReturnType<typeof api.submitRsvp>>) => void;
    const submit = vi.spyOn(api, 'submitRsvp').mockImplementation(() => new Promise((resolve) => { receive = resolve; }));
    const { unmount } = openForm();
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    const oldDraft = readDraft('confirmation-fingerprint')!;
    unmount();
    expect(submit.mock.calls[0][3]?.aborted).toBe(true);
    const newerDraft = { ...oldDraft, inviteeName: 'Newer answer' };
    saveDraft('confirmation-fingerprint', newerDraft);
    await act(async () => receive({ ok: true, duplicate: false }));
    expect(readDraft('confirmation-fingerprint')).toEqual(newerDraft);
  });
});
