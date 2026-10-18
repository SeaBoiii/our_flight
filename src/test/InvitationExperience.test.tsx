import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InvitationExperience from '../components/InvitationExperience';
import { copy } from '../copy';
import { saveRsvpReceipt } from '../storage';
import { experienceCopy } from '../experienceCopy';
import { invitationForClass } from '../invitations';
import { mapUrl } from '../venue';
import type { Invitation } from '../types';
import { invitationWith } from './fixtures';

function renderExperience(invitation: Invitation = invitationWith()) {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  return render(
    <InvitationExperience
      invitation={invitation}
      accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
      fingerprint="experience-fingerprint"
      locale="en"
      reducedMotion
      onBack={() => undefined}
      onToggleLocale={() => undefined}
    />,
  );
}

function followFragment(link: HTMLElement) {
  // jsdom queues link navigation in a timer, unlike browsers' native default
  // action. Complete the fragment change after React's handler and before its
  // next animation frame, leaving the actual browser behavior to the e2e tests.
  document.addEventListener('click', (event) => event.preventDefault(), { once: true });
  fireEvent.click(link);
  window.history.pushState(null, '', link.getAttribute('href'));
}

describe('invitation details', () => {
  describe('wedding-day itinerary', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('puts today ahead of a landed event and shows both itinerary statuses', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2027-08-22T13:00:00+08:00'));
      vi.stubEnv('VITE_GALLERY_URL', 'https://gallery.example.test/');

      const { container } = renderExperience(invitationForClass('business', 'groom'));

      const todayPanel = screen.getByRole('region', { name: 'We are celebrating now' });
      expect(todayPanel.classList.contains('today-panel--during')).toBe(true);
      const cards = container.querySelectorAll<HTMLElement>('.itinerary-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].querySelector('time')?.getAttribute('datetime')).toBe('2027-08-22');
      expect(cards[0].classList.contains('itinerary-card--today')).toBe(true);
      expect(cards[0].classList.contains('itinerary-card--landed')).toBe(false);
      expect(within(cards[0]).getByText('Today').classList.contains('itinerary-status')).toBe(true);
      expect(cards[1].querySelector('time')?.getAttribute('datetime')).toBe('2027-08-21');
      expect(cards[1].classList.contains('itinerary-card--landed')).toBe(true);
      expect(cards[1].classList.contains('itinerary-card--today')).toBe(false);
      expect(within(cards[1]).getByText('Landed').classList.contains('itinerary-status')).toBe(true);
    });

    it('shows no today panel or itinerary status badges before the wedding', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2027-08-20T13:00:00+08:00'));
      vi.stubEnv('VITE_GALLERY_URL', 'https://gallery.example.test/');

      const { container } = renderExperience(invitationForClass('business', 'groom'));

      expect(container.querySelector('.today-panel')).toBeNull();
      expect(container.querySelector('.itinerary-status')).toBeNull();
      const cards = container.querySelectorAll<HTMLElement>('.itinerary-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].querySelector('time')?.getAttribute('datetime')).toBe('2027-08-21');
      expect(cards[1].querySelector('time')?.getAttribute('datetime')).toBe('2027-08-22');
      cards.forEach((card) => {
        expect(card.classList.contains('itinerary-card--today')).toBe(false);
        expect(card.classList.contains('itinerary-card--landed')).toBe(false);
      });
    });
  });

  it('uses the Arabic Bismillah and a date-first editable programme', () => {
    const { container } = renderExperience();
    const bismillah = screen.getByText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(bismillah.getAttribute('lang')).toBe('ar');
    expect(bismillah.getAttribute('dir')).toBe('rtl');
    expect(copy.ms.bismillah).toBe('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');

    const dateHeading = screen.getByRole('heading', { name: 'Sunday, 22 August 2027' });
    const itineraryCard = dateHeading.closest('article');
    expect(itineraryCard).not.toBeNull();
    expect(within(itineraryCard as HTMLElement).getByText("Groom's march-in")).toBeTruthy();
    expect(within(itineraryCard as HTMLElement).getByText('Kompang procession')).toBeTruthy();
    expect(within(itineraryCard as HTMLElement).getByText('Cake cutting')).toBeTruthy();
    expect(within(itineraryCard as HTMLElement).getAllByLabelText('Time to be confirmed')).toHaveLength(3);
    expect(container.querySelector('.travel-venue-logo')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('restores the complete original story before the itinerary', () => {
    renderExperience();
    const storyHeading = screen.getByRole('heading', { name: 'Our Story' });
    const itineraryHeading = screen.getByRole('heading', { name: 'Your itinerary' });
    expect(screen.queryByRole('heading', { name: 'Flight Dashboard' })).toBeNull();
    expect(storyHeading.compareDocumentPosition(itineraryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('“Some meetings feel less like chance and more like a promise finally finding its way home.”')).toBeTruthy();
    expect(screen.getByText(copy.en.storyBeginning)).toBeTruthy();
    expect(screen.getByText(copy.en.storyJourney)).toBeTruthy();
    expect(screen.getByText('By the grace of Allah, we are ready for our next chapter.')).toBeTruthy();
  });

  it('keeps Nikah out of every reception-only guest-facing description', () => {
    const { container } = renderExperience(invitationForClass('economy', 'bride'));
    const rsvp = container.querySelector('.rsvp-section') as HTMLElement;

    expect(screen.getAllByText('Wedding Reception').length).toBeGreaterThan(0);
    expect(within(rsvp).getByText('Wedding Reception')).toBeTruthy();
    expect(container.textContent).not.toMatch(/nikah/i);
  });

  it('keeps the venue, address, and directions visible while transport guidance is collapsed', () => {
    renderExperience();
    const heading = screen.getByRole('heading', { name: 'Getting here' });
    const venue = heading.closest('section') as HTMLElement;
    const details = venue.querySelector('details') as HTMLDetailsElement;
    const summary = details.querySelector('summary');
    expect(details.open).toBe(false);
    expect(summary).not.toBeNull();
    expect(heading.closest('details')).toBeNull();
    expect(within(venue).getByText(copy.en.address).closest('details')).toBeNull();
    const directions = within(venue).getByRole('link', { name: /Get directions/ });
    expect(directions.closest('details')).toBeNull();
    expect(directions.getAttribute('href')).toBe(mapUrl);
    fireEvent.click(summary as HTMLElement);
    expect(details.open).toBe(true);
    expect(screen.getByText(/Alight at Changi Airport station/)).toBeTruthy();
  });

  it('keeps the small Back and language controls and inline RSVP without a dock or Simple view', async () => {
    const { container } = renderExperience();
    const navigation = screen.getByRole('navigation', { name: copy.en.controls });
    expect(within(navigation).getByRole('button', { name: copy.en.back })).toBeTruthy();
    expect(within(navigation).queryByRole('link')).toBeNull();
    expect(container.querySelector('.experience-shortcuts, .simple-view-toggle, .guest-overview')).toBeNull();
    const rsvp = container.querySelector('.itinerary-rsvp') as HTMLElement;
    expect(rsvp.getAttribute('href')).toBe('#rsvp');
    followFragment(rsvp);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: copy.en.rsvpTitle })));
  });

  it('focuses the RSVP heading after native fragment navigation focuses its section', async () => {
    const { container } = renderExperience();
    const heading = screen.getByRole('heading', { name: copy.en.rsvpTitle });
    const section = heading.closest('section') as HTMLElement;
    section.tabIndex = -1;
    followFragment(container.querySelector('.itinerary-rsvp') as HTMLElement);
    // Browsers perform this native default action after the click handler.
    section.focus();
    expect(document.activeElement).toBe(section);
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(window.location.hash).toBe('#rsvp');
  });

  it('cancels pending shortcut focus on unmount and ignores modified clicks', () => {
    const { unmount, container } = renderExperience();
    const scheduleFocus = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
    const cancelFocus = vi.spyOn(window, 'cancelAnimationFrame');
    const shortcut = container.querySelector('.itinerary-rsvp') as HTMLElement;
    shortcut.addEventListener('click', (event) => event.preventDefault());
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      fireEvent.click(shortcut, { [modifier]: true });
    }
    expect(scheduleFocus).not.toHaveBeenCalled();
    fireEvent.click(shortcut);
    expect(scheduleFocus).toHaveBeenCalledOnce();
    unmount();
    expect(cancelFocus).toHaveBeenCalledWith(123);
  });

  it.each([
    ['economy', 'bride', ['AN2108']],
    ['economy', 'groom', ['AN2208']],
    ['business', 'groom', ['AN2108', 'AN2208']],
    ['first', 'bride', ['AN2108', 'AN2208']],
  ] as const)('shows itinerary details for %s on the %s side', (cabin, side, flights) => {
    const invitation = invitationForClass(cabin, side);
    const { container } = renderExperience(invitation);
    const cards = container.querySelectorAll<HTMLElement>('.itinerary-card');
    expect(cards).toHaveLength(flights.length);
    cards.forEach((card, index) => {
      const event = invitation.events[index];
      expect(card.textContent).toContain(flights[index]);
      expect(within(card).getByRole('heading', { name: event.title.en, level: 4 })).toBeTruthy();
      expect(within(card).getByRole('heading', { name: event.dateLabel.en, level: 3 })).toBeTruthy();
      expect(card.textContent).toContain(event.time);
      expect(card.textContent).toContain(invitation.hotel);
      expect(card.textContent).toContain(invitation.ballroom);
      expect(within(card).queryByRole('link')).toBeNull();
      expect(within(card).queryByRole('button')).toBeNull();
    });
  });

  it('opens the returning itinerary with focus and no journey or cabin/video assets', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { container } = render(
      <InvitationExperience invitation={invitationWith(2)} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="fast-track" locale="en" reducedMotion={false} entryMode="fast-track" onBack={() => undefined} onToggleLocale={() => undefined} />,
    );
    await waitFor(() => expect(document.activeElement?.id).toBe('itinerary-title'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(container.querySelector('.journey, .static-journey, video, img[src*="flight/cabin"], source[srcset*="flight/cabin"]')).toBeNull();
    expect(container.querySelector('#invitation')).toBeNull();
    expect(container.querySelector('#flight-dashboard')).toBeNull();
    expect(container.querySelectorAll('.itinerary-card')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Confirm your attendance/ }).getAttribute('href')).toBe('#rsvp');
    expect(screen.getByText('Welcome back.')).toBeTruthy();
    expect(screen.getByRole('button', { name: experienceCopy.en.replay })).toBeTruthy();
    expect(container.querySelector('#rsvp')).toBeTruthy();
  });
  it.each(['en', 'ms'] as const)('uses a verified full name in the %s welcome and replay, then clears it for another guest', async (locale) => {
    saveRsvpReceipt('personal', {
      version: 2, guestName: 'Nur Aisyah Binti Abdullah', responseId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      confirmedAt: '2026-09-27T00:00:00.000Z',
      responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
    });
    const invitation = invitationWith(1, 'open');
    const props = { invitation, accessCredential: { kind: 'class-code' as const, value: 'ALPHA123' }, fingerprint: 'personal', locale, reducedMotion: true, returning: true, onBack: vi.fn(), onReplay: vi.fn(), onToggleLocale: vi.fn() };
    const view = render(<InvitationExperience {...props} entryMode="fast-track" />);
    const words = experienceCopy[locale];
    expect(screen.getByText(words.welcomeName('Nur Aisyah Binti Abdullah'))).toBeTruthy();
    expect(screen.getByText(words.thankYou)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: words.replay }));
    expect(props.onReplay).toHaveBeenCalledOnce();
    view.rerender(<InvitationExperience {...props} entryMode="journey" />);
    expect(screen.getByText(words.personalInvite('Nur Aisyah Binti Abdullah'))).toBeTruthy();
    expect(screen.getByRole('button', { name: words.backToItinerary })).toBeTruthy();
    view.rerender(<InvitationExperience {...props} entryMode="fast-track" />);
    fireEvent.click(screen.getByRole('button', { name: locale === 'en' ? 'Another guest using this device' : 'Tetamu lain menggunakan peranti ini' }));
    fireEvent.click(screen.getByRole('button', { name: locale === 'en' ? 'Start another guest’s RSVP' : 'Mulakan RSVP tetamu lain' }));
    expect(screen.getByText(words.welcome)).toBeTruthy();
    expect(screen.queryByText(words.welcomeName('Nur Aisyah Binti Abdullah'))).toBeNull();
    view.rerender(<InvitationExperience {...props} entryMode="journey" />);
    expect(screen.queryByText(words.personalInvite('Nur Aisyah Binti Abdullah'))).toBeNull();
  });

  it('keeps version-one receipts usable with a generic return welcome', () => {
    saveRsvpReceipt('legacy-receipt', { version: 1, responseId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', confirmedAt: '2026-09-27T00:00:00.000Z', responses: [{ eventId: 'day22', attendance: 'attending', partySize: '1' }] });
    render(<InvitationExperience invitation={invitationWith()} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="legacy-receipt" locale="en" reducedMotion entryMode="fast-track" returning onBack={vi.fn()} onToggleLocale={vi.fn()} />);
    expect(screen.getByText('Welcome back.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'RSVP received on this device' })).toBeTruthy();
  });

});
