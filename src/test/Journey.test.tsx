import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Journey } from '../components/Journey';
import { invitationWith } from './fixtures';

describe('reduced-motion journey', () => {
  it('renders static cabin, cloud, and ticket panels without the sticky scene', () => {
    const { container } = render(
      <Journey invitation={invitationWith()} locale="en" reducedMotion />,
    );
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
    expect(screen.getByAltText('A bright, quiet aircraft cabin leading towards the window')).toBeTruthy();
    expect(screen.getByAltText('Soft sunlit clouds seen from an aircraft window').getAttribute('src')).toContain('clouds-video-poster.webp');
    expect(container.querySelector('.static-journey')).toBeTruthy();
    expect(container.querySelector('.journey')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });
});

describe('animated cloud journey', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the silent forward-and-reverse cloud video as a looping background', () => {
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
    });

    const { container } = render(
      <Journey invitation={invitationWith()} locale="en" reducedMotion={false} />,
    );
    const video = container.querySelector<HTMLVideoElement>('.journey-cloud-video');
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.querySelector('source')?.getAttribute('src')).toContain('clouds-ping-pong.mp4');
  });
});
