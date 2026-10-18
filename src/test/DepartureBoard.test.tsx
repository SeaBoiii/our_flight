import { act, isInaccessible, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartureBoard } from '../components/DepartureBoard';
import { dockCopy } from '../dockCopy';
import { invitationForClass } from '../invitations';

const phases = [
  {
    phase: 'countdown',
    now: '2026-10-18T09:00:00+08:00',
    cabinClass: 'economy',
    summary: {
      en: 'Flight AN2208 departs in 308 days, 3 hours and 0 minutes.',
      ms: 'Penerbangan AN2208 berlepas dalam 308 hari, 3 jam dan 0 minit.',
    },
  },
  {
    phase: 'today',
    now: '2027-08-22T09:00:00+08:00',
    cabinClass: 'economy',
    summary: {
      en: 'Flight AN2208 boards today at 12:00.',
      ms: 'Penerbangan AN2208 mula menerima tetamu hari ini pada 12:00.',
    },
  },
  {
    phase: 'boarding',
    now: '2027-08-22T13:00:00+08:00',
    cabinClass: 'economy',
    summary: {
      en: 'Flight AN2208 is now boarding, until 16:00.',
      ms: 'Penerbangan AN2208 sedang berlangsung hingga 16:00.',
    },
  },
  {
    phase: 'between',
    now: '2027-08-21T18:00:00+08:00',
    cabinClass: 'business',
    summary: {
      en: 'Flight AN2208 departs in 0 days, 18 hours and 0 minutes.',
      ms: 'Penerbangan AN2208 berlepas dalam 0 hari, 18 jam dan 0 minit.',
    },
  },
  {
    phase: 'landed',
    now: '2027-08-23T09:00:00+08:00',
    cabinClass: 'business',
    summary: {
      en: 'All flights have landed. Thank you for flying with us.',
      ms: 'Semua penerbangan telah mendarat. Terima kasih kerana terbang bersama kami.',
    },
  },
] as const;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-18T09:00:00+08:00'));
});

afterEach(() => vi.useRealTimers());

describe.each(['en', 'ms'] as const)('DepartureBoard (%s)', (locale) => {
  it.each(phases)('renders an accessible summary in the $phase phase', ({ phase, now, cabinClass, summary }) => {
    vi.setSystemTime(new Date(now));
    const invitation = invitationForClass(cabinClass);
    render(<DepartureBoard events={invitation.events} locale={locale} />);

    const board = screen.getByRole('region', { name: dockCopy[locale].board });
    expect(board.classList.contains(`departure-board--${phase}`)).toBe(true);
    const accessibleSummary = within(board).getByText(summary[locale], { exact: true });
    expect(accessibleSummary.classList.contains('visually-hidden')).toBe(true);
    expect(isInaccessible(accessibleSummary)).toBe(false);

    // SplitFlap fills its animated cells on requestAnimationFrame. Its glyphs
    // are decorative; the summary above supplies the complete readable text.
    const flaps = board.querySelectorAll('.departure-flap');
    expect(flaps.length).toBeGreaterThan(0);
    flaps.forEach((flap) => {
      expect(flap.getAttribute('aria-hidden')).toBe('true');
      expect(isInaccessible(flap)).toBe(true);
    });
  });

  it('updates the summary minutes just after the next minute boundary', () => {
    vi.setSystemTime(new Date('2026-10-18T09:00:59+08:00'));
    render(<DepartureBoard events={invitationForClass('economy').events} locale={locale} />);
    const before = locale === 'en'
      ? 'Flight AN2208 departs in 308 days, 2 hours and 59 minutes.'
      : 'Penerbangan AN2208 berlepas dalam 308 hari, 2 jam dan 59 minit.';
    const after = locale === 'en'
      ? 'Flight AN2208 departs in 308 days, 2 hours and 58 minutes.'
      : 'Penerbangan AN2208 berlepas dalam 308 hari, 2 jam dan 58 minit.';
    const summary = screen.getByText(before, { exact: true });

    act(() => vi.advanceTimersByTime(999));
    expect(summary.textContent).toBe(before);
    act(() => vi.advanceTimersByTime(1_001));
    expect(summary.textContent).toBe(after);
    expect(isInaccessible(summary)).toBe(false);
  });
});
