import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RsvpForm } from '../components/RsvpForm';
import { invitationForClass } from '../invitations';
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
    expect(screen.getByText('Will you attend the wedding ceremony?')).toBeTruthy();
    expect(screen.getByLabelText('Your name').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send RSVP' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the same wedding-ceremony question separately for each invited day', () => {
    render(
      <RsvpForm
        invitation={invitationWith(2)}
        accessCredential={{ kind: 'class-code', value: 'ALPHA123' }}
        fingerprint="both-days-fingerprint"
        locale="en"
      />,
    );
    expect(screen.getAllByText('Will you attend the wedding ceremony?')).toHaveLength(2);
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

    expect(screen.getByText("Bride's Reception")).toBeTruthy();
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
