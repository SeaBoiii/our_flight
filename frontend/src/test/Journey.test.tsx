import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Journey } from '../components/Journey';
import { invitationWith } from './fixtures';

describe('reduced-motion journey', () => {
  it('renders static cabin, cloud, and ticket panels without the sticky scene', () => {
    const { container } = render(
      <Journey invitation={invitationWith()} locale="en" reducedMotion />,
    );
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
    expect(screen.getByAltText('A bright, quiet aircraft cabin leading towards the window')).toBeTruthy();
    expect(screen.getByAltText('Soft sunlit clouds seen from an aircraft window')).toBeTruthy();
    expect(container.querySelector('.static-journey')).toBeTruthy();
    expect(container.querySelector('.journey')).toBeNull();
  });
});
