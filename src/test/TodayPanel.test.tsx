import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodayPanel } from '../components/TodayPanel';
import { departureStatus } from '../departure';
import { googleMapsUrl, wazeUrl } from '../directions';
import { invitationForClass } from '../invitations';
import type { Locale } from '../types';
import { clockNow, galleryUrl, weddingDay } from '../weddingDay';

const gallery = 'https://gallery.example.test/';
const helpUrl = 'https://wa.me/6580000002?text=Assalamualaikum';

function renderToday(instant: string, configuredGallery = gallery, locale: Locale = 'en', configuredHelpUrl?: string) {
  vi.setSystemTime(new Date(instant));
  vi.stubEnv('VITE_GALLERY_URL', configuredGallery);
  const events = invitationForClass('business').events;
  const now = clockNow();
  return render(
    <TodayPanel
      day={weddingDay(events, now)}
      landed={departureStatus(events, now).phase === 'landed'}
      gallery={galleryUrl()}
      now={now}
      locale={locale}
      helpUrl={configuredHelpUrl}
    />,
  );
}

function expectExternalLinksSafe(container: HTMLElement) {
  for (const link of within(container).getAllByRole('link')) {
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
  }
}

function expectDirections(container: HTMLElement) {
  expect(within(container).getByRole('link', { name: /^Google Maps/ }).getAttribute('href')).toBe(googleMapsUrl);
  expect(within(container).getByRole('link', { name: /^Waze/ }).getAttribute('href')).toBe(wazeUrl);
  expectExternalLinksSafe(container);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TodayPanel', () => {
  it('renders nothing outside an event day before the guest has landed', () => {
    const { container } = renderToday('2027-08-20T13:00:00+08:00');
    expect(container.childElementCount).toBe(0);
  });

  it('shows the first programme item and navigation before the celebration, without photos', () => {
    const { container } = renderToday('2027-08-22T09:30:00+08:00');
    const panel = screen.getByRole('region', { name: 'See you at the gate' });
    expect(panel.classList.contains('today-panel--before')).toBe(true);
    const rows = within(panel).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('First up')).toBeTruthy();
    expect(within(rows[0]).getByText('12:00')).toBeTruthy();
    expect(within(rows[0]).getByText('Guest arrival')).toBeTruthy();
    expectDirections(panel);
    expect(within(container).queryByRole('link', { name: /^Share your photos/ })).toBeNull();
  });

  it.each([
    ['with a configured gallery', gallery],
    ['without a gallery', ''],
  ])('shows the current and next programme items during the celebration %s', (_description, configuredGallery) => {
    renderToday('2027-08-22T13:00:00+08:00', configuredGallery);
    const panel = screen.getByRole('region', { name: 'We are celebrating now' });
    expect(panel.classList.contains('today-panel--during')).toBe(true);
    const rows = within(panel).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Now')).toBeTruthy();
    expect(within(rows[0]).getByText('12:30')).toBeTruthy();
    expect(within(rows[0]).getByText('Kompang procession')).toBeTruthy();
    expect(rows[0].classList.contains('is-live')).toBe(true);
    expect(within(rows[1]).getByText('Next')).toBeTruthy();
    expect(within(rows[1]).getByText('14:30')).toBeTruthy();
    expect(within(rows[1]).getByText('Couple march-in')).toBeTruthy();
    expectDirections(panel);
    if (configuredGallery) {
      expect(within(panel).getByRole('link', { name: /^Share your photos/ }).getAttribute('href')).toBe(gallery);
    } else {
      expect(within(panel).queryByRole('link', { name: /^Share your photos/ })).toBeNull();
    }
  });

  it('thanks guests after the celebration and offers photos without navigation or programme rows', () => {
    renderToday('2027-08-22T17:00:00+08:00');
    const panel = screen.getByRole('region', { name: 'Thank you for celebrating with us' });
    expect(panel.classList.contains('today-panel--after')).toBe(true);
    expect(within(panel).queryByRole('list')).toBeNull();
    expect(within(panel).queryByRole('link', { name: /^Google Maps/ })).toBeNull();
    expect(within(panel).queryByRole('link', { name: /^Waze/ })).toBeNull();
    expect(within(panel).getByRole('link', { name: /^Share your photos/ }).getAttribute('href')).toBe(gallery);
    expectExternalLinksSafe(panel);
  });

  it('shows the landed thank-you and photos after the final event day', () => {
    renderToday('2027-08-23T09:30:00+08:00');
    const panel = screen.getByRole('region', { name: 'Thank you for flying with us' });
    expect(panel.classList.contains('today-panel--landed')).toBe(true);
    expect(within(panel).getAllByRole('link')).toHaveLength(1);
    expect(within(panel).getByRole('link', { name: /^Share your photos/ }).getAttribute('href')).toBe(gallery);
    expectExternalLinksSafe(panel);
  });

  it('renders nothing after the final event day when there is no gallery', () => {
    const { container } = renderToday('2027-08-23T09:30:00+08:00', '');
    expect(container.childElementCount).toBe(0);
  });

  it('localizes the active celebration and programme in Malay', () => {
    renderToday('2027-08-22T13:00:00+08:00', gallery, 'ms');
    const panel = screen.getByRole('region', { name: 'Majlis sedang berlangsung' });
    const rows = within(panel).getAllByRole('listitem');
    expect(within(rows[0]).getByText('Sekarang')).toBeTruthy();
    expect(within(rows[0]).getByText('Perarakan kompang')).toBeTruthy();
    expect(within(rows[1]).getByText('Seterusnya')).toBeTruthy();
    expect(within(rows[1]).getByText('Perarakan masuk pengantin lelaki')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: /^Kongsi gambar anda/ }).getAttribute('href')).toBe(gallery);
    expectDirections(panel);
  });

  it.each([
    ['before', '2027-08-22T09:30:00+08:00', 'en', 'Lost? Message the family'],
    ['during', '2027-08-22T13:00:00+08:00', 'en', 'Lost? Message the family'],
    ['before', '2027-08-22T09:30:00+08:00', 'ms', 'Sesat? Hubungi keluarga'],
    ['during', '2027-08-22T13:00:00+08:00', 'ms', 'Sesat? Hubungi keluarga'],
  ] as const)('offers a safe family help link %s the celebration at %s (%s)', (_stage, instant, locale, label) => {
    renderToday(instant, gallery, locale, helpUrl);

    const link = screen.getByRole('link', { name: label });
    expect(link.getAttribute('href')).toBe(helpUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
  });

  it.each([
    ['before', '2027-08-22T09:30:00+08:00'],
    ['during', '2027-08-22T13:00:00+08:00'],
  ])('does not offer family help %s the celebration when helpUrl is undefined', (_stage, instant) => {
    renderToday(instant);

    expect(screen.queryByRole('link', { name: 'Lost? Message the family' })).toBeNull();
  });

  it.each([
    ['after', '2027-08-22T17:00:00+08:00', 'Thank you for celebrating with us'],
    ['landed', '2027-08-23T09:30:00+08:00', 'Thank you for flying with us'],
  ])('does not offer family help in the %s stage even with helpUrl configured', (_stage, instant, title) => {
    renderToday(instant, gallery, 'en', helpUrl);

    const panel = screen.getByRole('region', { name: title });
    expect(within(panel).queryByRole('link', { name: 'Lost? Message the family' })).toBeNull();
    expect(within(panel).queryByRole('link', { name: /^Share your photos/ })).toBeTruthy();
  });
});
