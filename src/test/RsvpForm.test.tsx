import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { RsvpForm } from '../components/RsvpForm';
import { invitationForClass } from '../invitations';
import { clearSavedGuestData, readDraft, readRsvpDraftState, readRsvpReceipt, readRsvpReceiptState, saveDraft, saveRsvpReceipt, type SavedRsvpReceipt } from '../storage';
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
    expect(screen.getByText('Will you attend this celebration?')).toBeTruthy();
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the attendance question separately for each invited celebration', () => {
    render(
      <RsvpForm
        invitation={invitationWith(2)}
        accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
        fingerprint="both-days-fingerprint"
        locale="en"
      />,
    );
    expect(screen.getAllByText('Will you attend this celebration?')).toHaveLength(2);
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

    expect(screen.getByText('Wedding Reception')).toBeTruthy();
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
    expect(screen.getByText('Resepsi Perkahwinan')).toBeTruthy();
    expect(screen.getByText('AN2108')).toBeTruthy();
    expect(screen.queryByText('AN2208')).toBeNull();
    expect(container.textContent).not.toMatch(/nikah/i);
    expect(screen.getByText('Kelas Ekonomi')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tambah ke kalendar' }).getAttribute('href'))
      .toBe('/calendar/aleem-nurulain-day21-reception-single-day-ms.ics');
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
    expect(readRsvpReceipt('confirmation-fingerprint')).toBeNull();
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
    expect(readDraft('confirmation-fingerprint')).toEqual({ ...saved, submissionLocale: 'en', submissionState: 'unconfirmed' });
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear saved response' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    expect(submit.mock.calls[1][2]).toEqual(submit.mock.calls[0][2]);
    expect(screen.getByText('This RSVP was already received. No duplicate response was created.')).toBeTruthy();
  });

  it('preserves a conflicting response and directs amendments through the original invitation without creating a new submission', async () => {
    const submit = vi.spyOn(api, 'submitRsvp').mockRejectedValue(new api.ApiFailure(422, 'idempotency_conflict'));
    const { unmount } = openForm();
    completeResponse(['attending']);
    const saved = readDraft('confirmation-fingerprint');
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    await screen.findByText(/An earlier RSVP was received with different answers/);
    expect(readDraft('confirmation-fingerprint')).toEqual({ ...saved, submissionLocale: 'en', submissionState: 'conflict' });
    expect(screen.queryByRole('heading', { name: 'Your seat is confirmed' })).toBeNull();
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear saved response' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear saved response' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Aminah' } });
    expect(readDraft('confirmation-fingerprint')?.responseId).toBe(saved?.responseId);
    expect(readDraft('confirmation-fingerprint')?.inviteeName).toBe(saved?.inviteeName);
    unmount();
    openForm();
    expect(screen.getByText(/An earlier RSVP was received with different answers/)).toBeTruthy();
    fireEvent.submit(document.querySelector('form')!);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readRsvpReceipt('confirmation-fingerprint')).toBeNull();
  });

  it('continues showing server field errors without clearing the submitted draft', async () => {
    vi.spyOn(api, 'submitRsvp').mockRejectedValue(new api.ApiFailure(422, 'invalid_fields', ['responses.day22.partySize']));
    openForm();
    completeResponse(['attending']);
    const saved = readDraft('confirmation-fingerprint');
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));

    const error = await screen.findByRole('alert');
    expect(within(error).getByRole('link', { name: 'Enter a whole number of 1 or more.' }).getAttribute('href')).toBe('#party-size-0');
    expect(readDraft('confirmation-fingerprint')).toEqual(saved);
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(false);
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
    expect(screen.getByLabelText('Nama anda').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Padam jawapan tersimpan' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nama anda'), { target: { value: 'Changed answer' } });
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
    expect(screen.getByText(/could not save the confirmation for your next visit/)).toBeTruthy();
    expect(readRsvpReceiptState('confirmation-fingerprint')?.persisted).toBe(false);
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

describe('RSVP return visits', () => {
  const savedReceipt: SavedRsvpReceipt = {
    version: 1,
    responseId: '123e4567-e89b-42d3-a456-426614174000',
    confirmedAt: '2026-09-27T00:00:00.000Z',
    responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
  };

  it('retains uncertain answers and retry identity through remount with blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const submit = vi.spyOn(api, 'submitRsvp')
      .mockRejectedValueOnce(new api.ApiFailure(0, 'unconfirmed'))
      .mockResolvedValueOnce({ ok: true, duplicate: true });
    const { unmount } = openForm();
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByText(/We could not confirm whether your RSVP reached us/);
    const firstAttempt = readRsvpDraftState('confirmation-fingerprint');
    expect(firstAttempt?.persisted).toBe(false);
    unmount();
    openForm(invitationWith(1, 'open'), 'ms');
    expect((screen.getByLabelText('Nama anda') as HTMLInputElement).value).toBe('Aminah Rahman');
    expect(screen.getByLabelText('Nama anda').closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByText(/Pelayar ini tidak dapat menyimpan jawapan yang cuba dihantar/)).toBeTruthy();
    expect(screen.queryByText(/Jawapan yang cuba dihantar disimpan pada peranti ini/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hantar RSVP' }));
    await screen.findByRole('heading', { name: 'Tempat anda telah disahkan' });
    expect(submit.mock.calls[1][2]).toEqual(submit.mock.calls[0][2]);
    expect(submit.mock.calls.map((call) => call[1])).toEqual(['en', 'en']);
    expect(readDraft('confirmation-fingerprint')).toBeNull();
  });

  it('restores a volatile verified receipt on the same visit without promising future persistence, and forgets it explicitly', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const submit = vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    const first = openForm();
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    first.unmount();
    const second = openForm();
    expect(screen.getByRole('heading', { name: 'RSVP received on this device' })).toBeTruthy();
    expect(screen.getByText(/could not save the confirmation for your next visit/)).toBeTruthy();
    expect(screen.queryByText(/A confirmation is saved on this device/)).toBeNull();
    expect(screen.queryByText(/Your name and confirmation are saved/)).toBeNull();
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.getByText('Aminah Rahman')).toBeTruthy();
    expect(readRsvpReceipt('confirmation-fingerprint')?.guestName).toBe('Aminah Rahman');
    expect(submit).toHaveBeenCalledTimes(1);
    second.unmount();
    clearSavedGuestData();
    openForm();
    expect(screen.queryByRole('heading', { name: 'RSVP received on this device' })).toBeNull();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
  });

  it('remembers the verified guest name after remount without saving the message or moving focus away from the return overview', async () => {
    const submit = vi.spyOn(api, 'submitRsvp').mockResolvedValue({ ok: true, duplicate: false });
    const onReceiptChange = vi.fn();
    const invitation = invitationWith(1, 'open');
    const props = { invitation, accessCredential: { kind: 'class-code' as const, value: 'ALPHA123' }, fingerprint: 'confirmation-fingerprint', locale: 'en' as const, onReceiptChange };
    const { unmount } = render(<RsvpForm {...props} />);
    completeResponse(['attending']);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Aminah Rahman  ' } });
    expect(readRsvpReceipt('confirmation-fingerprint')).toBeNull();
    expect(onReceiptChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText('Message for Aleem & Nurulain (optional)'), { target: { value: 'Private personal message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByRole('heading', { name: 'Your seat is confirmed' });
    const receipt = readRsvpReceipt('confirmation-fingerprint', ['day22']);
    expect(receipt?.responses).toEqual(savedReceipt.responses);
    expect(receipt?.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(receipt?.version).toBe(2);
    expect(receipt?.guestName).toBe('Aminah Rahman');
    expect(JSON.stringify(receipt)).not.toMatch(/Private personal message|inviteeName|message/);
    expect(readDraft('confirmation-fingerprint')).toBeNull();
    expect(onReceiptChange).toHaveBeenLastCalledWith(receipt);
    unmount();
    render(<RsvpForm {...props} />);
    const heading = screen.getByRole('heading', { name: 'RSVP received on this device' });
    expect(document.activeElement).not.toBe(heading);
    expect(screen.getByText(/They may belong to another guest/)).toBeTruthy();
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.getByText('Aminah Rahman')).toBeTruthy();
    expect(screen.getByText(/Your name and confirmation are saved on this device/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send RSVP' })).toBeNull();
    expect(screen.getByText('Number attending, including you:').textContent).toContain('2');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([
    new api.ApiFailure(410, 'closed'),
    new api.ApiFailure(409, 'preview'),
    new api.ApiFailure(0, 'submission_failed'),
    new api.ApiFailure(422, 'invalid_fields', ['responses.day22.partySize']),
  ])('preserves an earlier uncertain attempt even if a later retry is rejected: %j', async (retryError) => {
    const submit = vi.spyOn(api, 'submitRsvp')
      .mockRejectedValueOnce(new api.ApiFailure(0, 'unconfirmed'))
      .mockRejectedValueOnce(retryError);
    const { unmount } = openForm();
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByText(/We could not confirm whether your RSVP reached us/);
    const uncertain = readDraft('confirmation-fingerprint');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' })); });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(readDraft('confirmation-fingerprint')).toEqual(uncertain);
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear saved response' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    openForm();
    expect(screen.getByText(/We could not confirm whether your RSVP reached us/)).toBeTruthy();
    expect(readDraft('confirmation-fingerprint')).toEqual(uncertain);
  });

  it('requires an explicit separate-guest action to replace a device confirmation with a fresh form', () => {
    const namedReceipt: SavedRsvpReceipt = { ...savedReceipt, version: 2, guestName: 'Aminah Rahman' };
    saveRsvpReceipt('confirmation-fingerprint', namedReceipt);
    const onReceiptChange = vi.fn();
    render(<RsvpForm invitation={invitationWith(1, 'open')} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="confirmation-fingerprint" locale="en" onReceiptChange={onReceiptChange} />);
    expect(onReceiptChange).toHaveBeenLastCalledWith(namedReceipt);
    expect(screen.getByText('Aminah Rahman')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Another guest using this device' }));
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.getByText(/This does not change the earlier response/)).toBeTruthy();
    expect(readRsvpReceipt('confirmation-fingerprint')).toEqual(namedReceipt);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this confirmation' }));
    expect(readRsvpReceipt('confirmation-fingerprint')).toEqual(namedReceipt);
    fireEvent.click(screen.getByRole('button', { name: 'Another guest using this device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start another guest’s RSVP' }));
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
    expect(readRsvpReceipt('confirmation-fingerprint')).toBeNull();
    expect(screen.queryByText('Aminah Rahman')).toBeNull();
    expect(onReceiptChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Another guest' } });
    expect(readDraft('confirmation-fingerprint')?.responseId).not.toBe(savedReceipt.responseId);
  });

  it('keeps a stored receipt useful when RSVP has closed, with no option to start another response', () => {
    saveRsvpReceipt('confirmation-fingerprint', savedReceipt);
    openForm(invitationWith(1, 'closed'), 'ms');
    expect(screen.getByRole('heading', { name: 'RSVP diterima pada peranti ini' })).toBeTruthy();
    expect(screen.getByText(/sila balas mesej jemputan asal/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tetamu lain menggunakan peranti ini' })).toBeNull();
    expect(screen.queryByText('Nama anda')).toBeNull();
    expect(screen.getByText(/Pengesahan disimpan pada peranti ini/)).toBeTruthy();
  });

  it('restores a named disk receipt with bilingual privacy copy and passes the verified name to its parent', () => {
    window.localStorage.setItem('our-flight:receipt:confirmation-fingerprint', JSON.stringify({ ...savedReceipt, version: 2, guestName: '  Nur Aisyah  ' }));
    const onReceiptChange = vi.fn();
    const props = {
      invitation: invitationWith(1, 'open'),
      accessCredential: { kind: 'class-code' as const, value: 'ALPHA123' },
      fingerprint: 'confirmation-fingerprint',
      onReceiptChange,
    };
    const { rerender } = render(<RsvpForm {...props} locale="en" />);
    expect(screen.getByText('Nur Aisyah')).toBeTruthy();
    expect(onReceiptChange).toHaveBeenLastCalledWith({ ...savedReceipt, version: 2, guestName: 'Nur Aisyah' });
    rerender(<RsvpForm {...props} locale="ms" />);
    expect(screen.getByText('Nur Aisyah')).toBeTruthy();
    expect(screen.getByText(/Nama dan pengesahan anda disimpan/)).toBeTruthy();
    expect(screen.queryByLabelText('Nama anda')).toBeNull();
  });

  it('keeps an old v1 receipt confirmed without assigning a name from an unrelated draft', () => {
    window.localStorage.setItem('our-flight:receipt:confirmation-fingerprint', JSON.stringify(savedReceipt));
    saveDraft('different-fingerprint', { responseId: savedReceipt.responseId, inviteeName: 'Unrelated guest', message: '', responses: savedReceipt.responses });
    const onReceiptChange = vi.fn();
    render(<RsvpForm invitation={invitationWith(1, 'open')} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="confirmation-fingerprint" locale="en" onReceiptChange={onReceiptChange} />);
    expect(screen.getByRole('heading', { name: 'RSVP received on this device' })).toBeTruthy();
    expect(screen.queryByText('Unrelated guest')).toBeNull();
    expect(screen.queryByText('Your name')).toBeNull();
    expect(onReceiptChange).toHaveBeenLastCalledWith(savedReceipt);
  });

  it('does not treat a receipt for a different event set as this invitation’s confirmation', () => {
    saveRsvpReceipt('confirmation-fingerprint', savedReceipt);
    openForm(invitationWith(2, 'open'));
    expect(screen.queryByRole('heading', { name: 'RSVP received on this device' })).toBeNull();
    expect(screen.getByLabelText('Your name')).toBeTruthy();
  });

  it.each([
    { code: 'closed', status: 410, message: /Online RSVP has closed/, disabled: true },
    { code: 'preview', status: 409, message: /RSVP is not open yet/, disabled: true },
    { code: 'not_configured', status: 503, message: /Online RSVP is temporarily unavailable/, disabled: false },
  ])('explains a $code response instead of suggesting a connection problem', async ({ code, status, message, disabled }) => {
    vi.spyOn(api, 'submitRsvp').mockRejectedValue(new api.ApiFailure(status, code));
    openForm();
    completeResponse(['attending']);
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    await screen.findByText(message);
    expect(screen.queryByText(/Check your connection/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(disabled);
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Aminah Rahman');
    expect(readRsvpReceipt('confirmation-fingerprint')).toBeNull();
    expect(readDraft('confirmation-fingerprint')?.submissionState).toBeUndefined();
  });
});
