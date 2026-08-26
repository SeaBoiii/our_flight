import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardingPass } from '../components/BoardingPass';
import { invitationWith } from './fixtures';

describe('BoardingPass', () => {
  it('renders two reference-style passes for a both-days invitation', () => {
    const invitation = invitationWith(2);
    const { container } = render(<BoardingPass invitation={invitation} locale="en" />);
    expect(container.querySelectorAll('.full-ticket')).toHaveLength(2);
    expect(screen.getByText('Nikah')).toBeTruthy();
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(screen.getByText("Groom's Reception")).toBeTruthy();
    expect(screen.getAllByText('AN2108').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('AN2208').length).toBeGreaterThanOrEqual(2);
  });

  it('renders only the 22 August pass for a one-day invitation', () => {
    const { container } = render(<BoardingPass invitation={invitationWith()} locale="en" />);
    expect(container.querySelectorAll('.full-ticket')).toHaveLength(1);
    expect(screen.queryByText('AN2108')).toBeNull();
    expect(screen.getAllByText('AN2208').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Crowne Plaza at Changi Airport')).toBeTruthy();
    expect(screen.getAllByText('Chengal').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps Walimatul Urus in the Malay ticket', () => {
    render(<BoardingPass invitation={invitationWith()} locale="ms" />);
    expect(screen.getByText('Walimatul Urus')).toBeTruthy();
    expect(screen.queryByText("Groom's Reception")).toBeNull();
  });

  it('provides a working boarding action', () => {
    vi.useFakeTimers();
    const onBoard = vi.fn();
    render(<BoardingPass invitation={invitationWith()} locale="en" onBoard={onBoard} />);
    screen.getByRole('button', { name: 'Tap ticket to scan and board' }).click();
    expect(screen.queryByText('Board Flight')).toBeNull();
    expect(onBoard).not.toHaveBeenCalled();
    vi.advanceTimersByTime(900);
    expect(onBoard).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it.each([
    ['economy', 'Economy', 'Economy Class'],
    ['premium-economy', 'Premium Economy', 'Premium Economy Class'],
    ['business', 'Business', 'Business Class'],
    ['first', 'First Class', 'First Class'],
  ] as const)('renders the %s class band', (cabinClass, label, classTitle) => {
    const invitation = invitationWith();
    invitation.cabinClass = cabinClass;
    invitation.cabinLabel = { en: label, ms: label };

    const { container } = render(<BoardingPass invitation={invitation} locale="en" />);

    expect(container.querySelector('.ticket-stack')?.classList.contains(`cabin-${cabinClass}`)).toBe(true);
    expect(screen.getAllByText(classTitle).length).toBeGreaterThanOrEqual(2);
  });
});
