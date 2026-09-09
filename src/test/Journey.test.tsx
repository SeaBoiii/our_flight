import { act, render, screen } from '@testing-library/react';
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

  const stubIntersectionObserver = () => {
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
    });
  };

  it('uses the silent forward-and-reverse cloud video as a looping background', () => {
    stubIntersectionObserver();

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

  it('marks the business and first ticket stacks for responsive fitting', () => {
    stubIntersectionObserver();
    const businessInvitation = invitationWith(2);
    const { container, rerender } = render(
      <Journey invitation={businessInvitation} locale="en" reducedMotion={false} />,
    );
    expect(container.querySelector('.journey-ticket--business')).toBeTruthy();

    const firstInvitation = {
      ...businessInvitation,
      cabinClass: 'first' as const,
      cabinLabel: { en: 'First Class', ms: 'Kelas Pertama' },
    };
    rerender(
      <Journey invitation={firstInvitation} locale="en" reducedMotion={false} />,
    );
    expect(container.querySelector('.journey-ticket--first')).toBeTruthy();
  });

  it('contains the ticket and welcome copy in separate grid rows', () => {
    stubIntersectionObserver();
    const { container } = render(
      <Journey invitation={invitationWith(2)} locale="en" reducedMotion={false} />,
    );
    const opening = container.querySelector('.journey-opening');
    const slot = container.querySelector('.journey-ticket-slot');
    const ticket = container.querySelector('.journey-ticket');
    const intro = container.querySelector('.journey-intro');

    expect(opening?.children[0]).toBe(slot);
    expect(opening?.children[1]).toBe(intro);
    expect(slot?.contains(ticket)).toBe(true);
    expect(slot?.contains(intro)).toBe(false);
  });

  it.each([
    { saveData: true, effectiveType: '4g' },
    { saveData: false, effectiveType: '2g' },
    { effectiveType: 'slow-2g' },
  ])('uses static clouds without mounting a video for %j', (connection) => {
    stubIntersectionObserver();
    vi.stubGlobal('navigator', { connection });
    const { container } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion={false} />);
    expect(container.querySelector('.journey')).toBeTruthy();
    expect(container.querySelector('video, source[type="video/mp4"]')).toBeNull();
    expect(container.querySelector('.journey-clouds > img')?.getAttribute('src')).toContain('clouds-video-poster.webp');
  });

  it('reacts when data saver is enabled during the visit and cleans up its subscription', () => {
    stubIntersectionObserver();
    const connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' });
    const unsubscribe = vi.spyOn(connection, 'removeEventListener');
    vi.stubGlobal('navigator', { connection });
    const { container, unmount } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion={false} />);
    expect(container.querySelector('video')).toBeTruthy();
    act(() => {
      connection.saveData = true;
      connection.dispatchEvent(new Event('change'));
    });
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.journey-clouds > img')).toBeTruthy();
    unmount();
    expect(unsubscribe).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
