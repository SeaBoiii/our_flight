import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlightDashboard } from '../components/FlightDashboard';
import { invitationForClass } from '../invitations';
import * as calendar from '../calendar';
import { mapUrl } from '../venue';

describe('Flight Dashboard', () => {
  it.each([
    ['economy', 'bride', ['AN2108']],
    ['economy', 'groom', ['AN2208']],
    ['business', 'groom', ['AN2108', 'AN2208']],
    ['first', 'bride', ['AN2108', 'AN2208']],
  ] as const)('derives cards and practical details for %s on the %s side', (cabin, side, flights) => {
    const invitation = invitationForClass(cabin, side);
    render(<FlightDashboard invitation={invitation} locale="en" />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(flights.length);
    cards.forEach((card, index) => {
      const event = invitation.events[index];
      expect(card.textContent).toContain(flights[index]);
      expect(within(card).getByRole('heading', { name: event.title.en, level: 3 })).toBeTruthy();
      expect(card.textContent).toContain(event.dateLabel.en);
      expect(card.textContent).toContain(event.time);
      expect(card.textContent).toContain(invitation.hotel);
      expect(card.textContent).toContain('Chengal Ballroom');
      expect(card.textContent).toContain('Terminal 3');
      expect(within(card).getByRole('link', { name: /Get directions/ }).getAttribute('href')).toBe(mapUrl);
    });
    if (side === 'bride' && cabin === 'economy') expect(document.body.textContent).not.toMatch(/Nikah/);
  });

  it('uses the shared calendar with the selected event and active language', () => {
    const download = vi.spyOn(calendar, 'downloadCalendar').mockImplementation(() => undefined);
    const invitation = invitationForClass('business');
    render(<FlightDashboard invitation={invitation} locale="ms" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah ke kalendar' })[1]);
    expect(download).toHaveBeenCalledWith(invitation.events[1], 'ms');
    expect(screen.getByRole('heading', { name: 'Paparan Penerbangan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sila Sahkan Kehadiran/ }).getAttribute('href')).toBe('#rsvp');
  });

  it('reports calendar errors only on the card that failed and allows retry', () => {
    const download = vi.spyOn(calendar, 'downloadCalendar').mockImplementationOnce(() => { throw new Error('unavailable'); }).mockImplementation(() => undefined);
    render(<FlightDashboard invitation={invitationForClass('business')} locale="en" />);
    const button = screen.getAllByRole('button', { name: 'Add to calendar' })[0];
    fireEvent.click(button);
    expect(screen.getByRole('alert').closest('article')).toBe(screen.getAllByRole('article')[0]);
    fireEvent.click(button);
    expect(download).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
