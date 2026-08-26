import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardingPass } from '../components/BoardingPass';
import { invitationWith } from './fixtures';

describe('BoardingPass', () => {
  it('renders two original-style passes for a both-days invitation', () => {
    const invitation = invitationWith(2);
    const { container } = render(<BoardingPass invitation={invitation} locale="en" />);
    expect(container.querySelectorAll('.full-ticket')).toHaveLength(2);
    expect(screen.getByText('Nikah')).toBeTruthy();
    expect(screen.getByText("Bride's Reception")).toBeTruthy();
    expect(screen.getByText('Walimatul Urus')).toBeTruthy();
    expect(screen.getByText('AN2108')).toBeTruthy();
    expect(screen.getByText('AN2208')).toBeTruthy();
  });

  it('renders only the 22 August pass for a one-day invitation', () => {
    const { container } = render(<BoardingPass invitation={invitationWith()} locale="en" />);
    expect(container.querySelectorAll('.full-ticket')).toHaveLength(1);
    expect(screen.queryByText('AN2108')).toBeNull();
    expect(screen.getByText('AN2208')).toBeTruthy();
    expect(screen.getByText('Crowne Plaza at Changi Airport')).toBeTruthy();
    expect(screen.getByText('Chengal')).toBeTruthy();
  });

  it('provides a working boarding action', () => {
    const onBoard = vi.fn();
    render(<BoardingPass invitation={invitationWith()} locale="en" onBoard={onBoard} />);
    screen.getByRole('button', { name: 'Board Flight' }).click();
    expect(onBoard).toHaveBeenCalledOnce();
  });
});
