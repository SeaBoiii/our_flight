import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarUrl } from '../calendar';
import { BoardingDock } from '../components/BoardingDock';
import { googleMapsUrl, venueAddress, wazeUrl } from '../directions';
import { dockCopy } from '../dockCopy';
import { invitationForClass } from '../invitations';
import type { InvitationEvent, Locale } from '../types';

type Bounds = { top: number; bottom: number };

const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
let layout: { itinerary: Bounds; rsvp: Bounds; footer: Bounds };
let frames: Map<number, FrameRequestCallback>;

function rect({ top, bottom }: Bounds): DOMRect {
  return {
    top, bottom, left: 0, right: 390, x: 0, y: top, width: 390, height: bottom - top,
    toJSON: () => ({ top, bottom }),
  };
}

function dockPage(calendarEvents: readonly InvitationEvent[], locale: Locale, checkedIn: boolean) {
  return (
    <>
      <section id="itinerary" />
      <section id="rsvp" />
      <footer className="site-footer" />
      <BoardingDock calendarEvents={calendarEvents} locale={locale} checkedIn={checkedIn} />
    </>
  );
}

function renderDock(calendarEvents: readonly InvitationEvent[] = [], locale: Locale = 'en', checkedIn = false) {
  return render(dockPage(calendarEvents, locale, checkedIn));
}

function measureAfter(event: 'scroll' | 'resize' = 'scroll') {
  fireEvent(window, new Event(event));
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
}

function expectDockVisible(dock: HTMLElement, visible: boolean) {
  expect(dock.classList.contains('boarding-dock--visible')).toBe(visible);
  expect(dock.getAttribute('aria-hidden')).toBe(String(!visible));
}

function forceDialogFallback(container: HTMLElement) {
  const dialog = container.querySelector('dialog') as HTMLDialogElement;
  // Exercise the component's fallback even when jsdom gains native dialog methods.
  Object.defineProperties(dialog, {
    showModal: { configurable: true, value: undefined },
    close: { configurable: true, value: undefined },
  });
  return dialog;
}

beforeEach(() => {
  layout = {
    itinerary: { top: 500, bottom: 1500 },
    rsvp: { top: 2000, bottom: 2500 },
    footer: { top: 3000, bottom: 3200 },
  };
  frames = new Map();
  let nextFrame = 0;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id === 'itinerary') return rect(layout.itinerary);
    if (this.id === 'rsvp') return rect(layout.rsvp);
    if (this.classList.contains('site-footer')) return rect(layout.footer);
    return rect({ top: 0, bottom: 0 });
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => { frames.delete(frame); });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('BoardingDock', () => {
  it('appears after the itinerary threshold and hides while RSVP or the footer is on screen', () => {
    layout.itinerary = { top: 1200, bottom: 2200 };
    renderDock();
    const dock = screen.getByRole('navigation', { hidden: true });
    expectDockVisible(dock, false);

    layout.itinerary = { top: 600, bottom: 1600 };
    measureAfter();
    expectDockVisible(dock, false);
    layout.itinerary = { top: 599, bottom: 1599 };
    measureAfter();
    expectDockVisible(dock, true);

    layout.rsvp = { top: 999, bottom: 1499 };
    measureAfter();
    expectDockVisible(dock, false);
    layout.rsvp = { top: -500, bottom: 0 };
    measureAfter();
    expectDockVisible(dock, true);

    layout.footer = { top: 900, bottom: 1100 };
    measureAfter();
    expectDockVisible(dock, false);
    layout.footer = { top: 3000, bottom: 3200 };
    measureAfter('resize');
    expectDockVisible(dock, true);
  });

  it.each(['en', 'ms'] as const)('shows three dock items and no calendar with no attending events in %s', (locale) => {
    renderDock([], locale);
    const dock = screen.getByRole('navigation', { name: dockCopy[locale].dock });
    expect(within(dock).queryByRole('link', { name: dockCopy[locale].dockCalendar })).toBeNull();
    expect(within(dock).queryByRole('button', { name: dockCopy[locale].dockCalendar })).toBeNull();
    expect(dock.querySelectorAll('.dock-item')).toHaveLength(3);
    expect(within(dock).getAllByRole('button').map((button) => button.textContent)).toEqual([
      dockCopy[locale].dockItinerary,
      dockCopy[locale].dockDirections,
      dockCopy[locale].dockCheckIn,
    ]);
  });

  it.each(['en', 'ms'] as const)('links directly to the one attending event calendar in %s', (locale) => {
    vi.stubEnv('BASE_URL', '/our_flight/');
    // A guest invited to both days can confirm attendance for just one day.
    const event = invitationForClass('business').events[1];
    renderDock([event], locale, true);
    const calendar = screen.getByRole('link', { name: dockCopy[locale].dockCalendar });
    expect(calendar.getAttribute('href')).toBe(calendarUrl(event, locale, '/our_flight/'));
    expect(screen.queryByRole('button', { name: dockCopy[locale].dockCalendar })).toBeNull();
  });

  it.each(['en', 'ms'] as const)('opens a calendar sheet listing exactly the two attending events in %s', (locale) => {
    vi.stubEnv('BASE_URL', '/our_flight/');
    const calendarEvents = invitationForClass('business').events;
    const { container } = renderDock(calendarEvents, locale, true);
    const dialog = forceDialogFallback(container);
    fireEvent.click(screen.getByRole('button', { name: dockCopy[locale].dockCalendar }));

    expect(screen.getByRole('dialog', { name: dockCopy[locale].calendarTitle })).toBe(dialog);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(within(dialog).getAllByRole('link')).toHaveLength(2);
    calendarEvents.forEach((event) => {
      const link = within(dialog).getByRole('link', { name: new RegExp(event.flightCode) });
      expect(link.textContent).toContain(event.dateLabel[locale]);
      expect(link.getAttribute('href')).toBe(calendarUrl(event, locale, '/our_flight/'));
    });
  });

  it.each(['en', 'ms'] as const)('opens and closes directions without native dialog methods in %s', (locale) => {
    const { container } = renderDock([], locale);
    const dock = screen.getByRole('navigation');
    const dialog = forceDialogFallback(container);
    expect(dialog.hasAttribute('open')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: dockCopy[locale].dockDirections }));

    expect(screen.getByRole('dialog', { name: dockCopy[locale].directionsTitle })).toBe(dialog);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(within(dialog).getByText(venueAddress)).toBeTruthy();
    for (const [name, href] of [['Google Maps', googleMapsUrl], ['Waze', wazeUrl]]) {
      const link = within(dialog).getByRole('link', { name: new RegExp(`^${name}`) });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noreferrer');
    }
    expect(within(dialog).getByRole('button', { name: locale === 'en' ? 'Copy address' : 'Salin alamat' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: dockCopy[locale].sheetClose }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expectDockVisible(dock, true);
  });

  it('copies the venue address and announces that the address was copied', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = renderDock();
    const dialog = forceDialogFallback(container);
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Copy address' }));
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(venueAddress);
    expect(within(dialog).getByRole('button', { name: 'Address copied' })).toBeTruthy();
    expect(within(dialog).getByRole('status').textContent).toBe('Address copied');
  });

  it.each([
    ['en', 'Check in', 'Checked in'],
    ['ms', 'Daftar masuk', 'Sudah daftar'],
  ] as const)('changes the primary action after checking in for %s', (locale, before, after) => {
    const { rerender } = renderDock([], locale);
    expect(screen.getByRole('button', { name: before }).classList.contains('dock-item--primary')).toBe(true);
    rerender(dockPage([], locale, true));
    expect(screen.queryByRole('button', { name: before })).toBeNull();
    expect(screen.getByRole('button', { name: after }).classList.contains('dock-item--primary')).toBe(true);
  });
});
