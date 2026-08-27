import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvitationExperience from '../components/InvitationExperience';
import { copy } from '../copy';
import { invitationWith } from './fixtures';

function renderExperience() {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  return render(
    <InvitationExperience
      invitation={invitationWith()}
      invitationToken={'d'.repeat(32)}
      fingerprint="experience-fingerprint"
      locale="en"
      reducedMotion
      onBack={() => undefined}
      onToggleLocale={() => undefined}
    />,
  );
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
    expect(storyHeading.compareDocumentPosition(itineraryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('“Some meetings feel less like chance and more like a promise finally finding its way home.”')).toBeTruthy();
    expect(screen.getByText('What began with an ordinary conversation grew into friendship, and then a quiet certainty.')).toBeTruthy();
    expect(screen.getByText('Through shared days, long prayers, and all the ordinary moments between, we found a home in one another.')).toBeTruthy();
    expect(screen.getByText('By the grace of Allah, we are ready for our next chapter.')).toBeTruthy();
  });

  it('keeps Getting here collapsed until the guest opens it', () => {
    renderExperience();
    const heading = screen.getByRole('heading', { name: 'Getting here' });
    const details = heading.closest('details') as HTMLDetailsElement;
    const summary = details.querySelector('summary');
    expect(details.open).toBe(false);
    expect(summary).not.toBeNull();
    fireEvent.click(summary as HTMLElement);
    expect(details.open).toBe(true);
    expect(screen.getByText(/Alight at Changi Airport station/)).toBeTruthy();
  });

  it('credits the cloud video and Mixkit source', () => {
    renderExperience();
    expect(screen.getByRole('link', { name: 'Clouds and blue sky background' }).getAttribute('href')).toContain('clouds-and-blue-sky-background-2408');
    expect(screen.getByRole('link', { name: 'Mixkit' }).getAttribute('href')).toBe('https://mixkit.co/');
  });
});
