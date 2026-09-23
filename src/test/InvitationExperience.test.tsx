import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvitationExperience from '../components/InvitationExperience';
import { copy } from '../copy';
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
    expect(container.querySelector('.venue-logo')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('places Our Story before the itinerary with the supplied wording', () => {
    renderExperience();
    const storyHeading = screen.getByRole('heading', { name: 'Our Story' });
    const itineraryHeading = screen.getByRole('heading', { name: 'Your itinerary' });
    expect(screen.queryByRole('heading', { name: 'Flight Dashboard' })).toBeNull();
    expect(storyHeading.compareDocumentPosition(itineraryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('“Some meetings feel less like chance and more like a promise finally finding its way home.”')).toBeTruthy();
    expect(screen.getByText('What began with an ordinary conversation grew into friendship, and then a quiet certainty.')).toBeTruthy();
    expect(screen.getByText('Through shared days, long prayers, and all the ordinary moments between, we found a home in one another.')).toBeTruthy();
    expect(screen.getByText('By the grace of Allah, we are ready for our next chapter.')).toBeTruthy();
  });

  it('keeps Nikah out of every reception-only guest-facing description', () => {
    const { container } = renderExperience(invitationForClass('economy', 'bride'));
    const rsvp = container.querySelector('.rsvp-section') as HTMLElement;

    expect(screen.getAllByText("Bride's Reception").length).toBeGreaterThan(0);
    expect(within(rsvp).getByText("Bride's Reception")).toBeTruthy();
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

  it('clears mobile shortcuts out of the way while editing a keyboard field', () => {
    const { container } = renderExperience();
    const experience = container.querySelector('main') as HTMLElement;
    const name = screen.getByRole('textbox', { name: copy.en.name });
    fireEvent.focusIn(name);
    expect(experience.hasAttribute('data-editing')).toBe(true);
    fireEvent.focusOut(name, { relatedTarget: screen.getByRole('radio', { name: copy.en.attending }) });
    expect(experience.hasAttribute('data-editing')).toBe(false);
    const message = screen.getByRole('textbox', { name: copy.en.message });
    fireEvent.focusIn(message);
    expect(experience.hasAttribute('data-editing')).toBe(true);
    fireEvent.focusOut(message);
    expect(experience.hasAttribute('data-editing')).toBe(false);
  });

  it('omits journey shortcuts while retaining the RSVP link after the itinerary', async () => {
    const { container } = renderExperience();
    const navigation = screen.getByRole('navigation', { name: copy.en.controls });
    expect(within(navigation).queryByRole('link')).toBeNull();
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
      expect(within(card).getByRole('link', { name: /Get directions/ }).getAttribute('href')).toBe(mapUrl);
    });
  });

  it('fast-tracks into the itinerary with focus and no journey or cabin/video assets', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const { container } = render(
      <InvitationExperience invitation={invitationWith(2)} accessCredential={{ kind: 'class-code', value: 'ALPHA123' }} fingerprint="fast-track" locale="en" reducedMotion={false} entryMode="fast-track" onBack={() => undefined} onToggleLocale={() => undefined} />,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your itinerary' })));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(container.querySelector('.journey, .static-journey, video, img[src*="flight/cabin"], source[srcset*="flight/cabin"]')).toBeNull();
    expect(container.querySelector('#invitation')).toBeTruthy();
    expect(container.querySelector('#flight-dashboard')).toBeNull();
    expect(container.querySelectorAll('.itinerary-card')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Confirm your attendance/ }).getAttribute('href')).toBe('#rsvp');
    expect(container.querySelector('#rsvp')).toBeTruthy();
  });
});
