import { lazy, Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExperienceBoundary } from '../components/ExperienceBoundary';
import { ExperienceRecovery } from '../components/ExperienceRecovery';
import { copy } from '../copy';
import { invitationForClass } from '../invitations';

describe('invitation loading recovery', () => {
  it('retains scoped event details and navigation while a lazy chunk loads and after it rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectChunk!: (error: Error) => void;
    const DelayedExperience = lazy(() => new Promise<{ default: () => null }>((_, reject) => { rejectChunk = reject; }));
    const invitation = invitationForClass('economy', 'bride');
    const onBack = vi.fn();
    render(
      <ExperienceBoundary fallback={<ExperienceRecovery invitation={invitation} locale="en" failed onBack={onBack} />}>
        <Suspense fallback={<ExperienceRecovery invitation={invitation} locale="en" onBack={onBack} />}>
          <DelayedExperience />
        </Suspense>
      </ExperienceBoundary>,
    );

    expect(screen.getByRole('heading', { name: copy.en.experienceLoading })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(copy.en.practicalDetails);
    expect(screen.getByText('AN2108')).toBeTruthy();
    expect(screen.queryByText('AN2208')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Nikah/);
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.en.back }));
    expect(onBack).toHaveBeenCalledOnce();

    await act(async () => { rejectChunk(new Error('Network failed while loading the invitation chunk')); });
    expect(await screen.findByRole('heading', { name: copy.en.experienceUnavailable })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(copy.en.experienceUnavailableBody);
    expect(screen.getByRole('link', { name: /Get directions/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.en.reloadInvitation })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nikah/);
  });
});
