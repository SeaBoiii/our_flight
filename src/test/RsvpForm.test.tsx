import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RsvpForm } from '../components/RsvpForm';
import { invitationWith } from './fixtures';

describe('RSVP preview mode', () => {
  it('shows the complete form while preventing a fake submission', () => {
    render(
      <RsvpForm
        invitation={invitationWith()}
        accessToken="preview-access-token"
        fingerprint="preview-fingerprint"
        locale="en"
        onSessionExpired={vi.fn()}
      />,
    );
    expect(screen.getByText('RSVP preview')).toBeTruthy();
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows linked validation errors before any open RSVP request is sent', () => {
    const invitation = invitationWith();
    invitation.rsvpStatus = 'open';
    render(
      <RsvpForm
        invitation={invitation}
        accessToken="open-access-token"
        fingerprint="open-fingerprint"
        locale="en"
        onSessionExpired={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send RSVP' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter your name.');
    expect(screen.getByRole('link', { name: 'Enter your name.' }).getAttribute('href')).toBe('#invitee-name');
    expect(screen.getByRole('link', { name: 'Select an attendance response.' }).getAttribute('href')).toBe('#attendance-0-yes');
  });
});
