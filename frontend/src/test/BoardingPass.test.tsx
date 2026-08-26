import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardingPass } from '../components/BoardingPass';
import { invitationWith } from './fixtures';

describe('BoardingPass', () => {
  it('renders only the sectors returned by the API', () => {
    const invitation = invitationWith(2);
    render(<BoardingPass invitation={invitation} locale="en" />);
    expect(screen.getByText('Celebration 1')).toBeTruthy();
    expect(screen.getByText('Celebration 2')).toBeTruthy();
  });

  it('provides a working boarding action', () => {
    const onBoard = vi.fn();
    render(<BoardingPass invitation={invitationWith()} locale="en" onBoard={onBoard} />);
    screen.getByRole('button', { name: 'Board Flight' }).click();
    expect(onBoard).toHaveBeenCalledOnce();
  });
});
