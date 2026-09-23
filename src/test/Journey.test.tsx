import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Journey } from '../components/Journey';
import { createCloudRenderer } from '../cloudRenderer';
import { invitationWith } from './fixtures';

vi.mock('../cloudRenderer', () => ({ createCloudRenderer: vi.fn() }));

let draw = vi.fn();
let dispose = vi.fn();
beforeEach(() => {
  draw = vi.fn();
  dispose = vi.fn();
  vi.mocked(createCloudRenderer).mockReset().mockReturnValue({ draw, dispose });
});
afterEach(() => vi.unstubAllGlobals());

function setupScrollScene() {
  let notifyIntersection: (visible: boolean) => void = () => undefined;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      notifyIntersection = (isIntersecting) => callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++frameId, callback); return frameId; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
  const rendered = render(<Journey invitation={invitationWith(2)} locale="en" reducedMotion={false} />);
  const section = rendered.container.querySelector<HTMLElement>('.journey')!;
  const stage = rendered.container.querySelector<HTMLElement>('.journey-stage')!;
  let top = 0;
  Object.defineProperties(stage, { clientWidth: { value: 390 }, clientHeight: { value: 800 } });
  vi.spyOn(section, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: top, top, bottom: top + 4800, left: 0, right: 390, width: 390, height: 4800, toJSON: () => ({}) }));
  return {
    ...rendered, section, requestFrame,
    nextFrame: () => act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach((callback) => callback(0)); }),
    intersect: (visible: boolean) => act(() => notifyIntersection(visible)),
    scroll: (progress: number) => act(() => { top = -progress * 4000; window.dispatchEvent(new Event('scroll')); }),
    hide: (value: boolean) => act(() => { hidden = value; document.dispatchEvent(new Event('visibilitychange')); }),
  };
}

describe('compact static journey', () => {
  it('keeps welcome and wedding identity readable without loading cinematic images', () => {
    const { container } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion />);
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
    expect(container.querySelector('.static-journey')).toBeTruthy();
    expect(container.querySelector('.journey')).toBeNull();
    expect(container.querySelector('img, video, source, canvas')).toBeNull();
    expect(container.textContent).toContain('Aleem');
    expect(createCloudRenderer).not.toHaveBeenCalled();
  });

  it('uses the static invitation when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion={false} />);
    expect(container.querySelector('.static-journey')).toBeTruthy();
    expect(container.querySelector('canvas')).toBeNull();
    expect(createCloudRenderer).not.toHaveBeenCalled();
  });

  it.each([{ saveData: true, effectiveType: '4g' }, { saveData: false, effectiveType: '2g' }, { effectiveType: 'slow-2g' }])(
    'never requests cinematic artwork for connection %j', (connection) => {
      vi.stubGlobal('navigator', { connection });
      const { container } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion={false} />);
      expect(container.querySelector('.static-journey')).toBeTruthy();
      expect(container.querySelector('img, picture, video, canvas')).toBeNull();
      expect(createCloudRenderer).not.toHaveBeenCalled();
    },
  );
});

describe('cinematic journey lifecycle', () => {
  it('mounts image layers progressively and retains them for reverse scrolling', () => {
    const scene = setupScrollScene();
    expect(scene.container.querySelector('.flight-airport img')).toBeNull();
    scene.intersect(true); scene.nextFrame();
    expect(scene.container.querySelector('.flight-airport img')).toBeTruthy();
    expect(scene.container.querySelector('.flight-departure img')).toBeTruthy();
    expect(scene.container.querySelector('.journey-cabin img')).toBeNull();
    scene.scroll(.1); scene.nextFrame();
    expect(scene.container.querySelector('.journey-cabin img')).toBeTruthy();
    expect(scene.container.querySelector('.journey-clouds img')).toBeTruthy();
    expect(createCloudRenderer).not.toHaveBeenCalled();
    scene.scroll(.5); scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    scene.scroll(0); scene.nextFrame();
    expect(scene.section.style.getPropertyValue('--ticket-opacity')).toBe('1');
    expect(scene.container.querySelector('.journey-cabin img')).toBeTruthy();
    expect(scene.container.querySelector('video')).toBeNull();
  });

  it('initializes near the cloud scene, draws its current frame immediately, and follows reverse scrolling', () => {
    const scene = setupScrollScene();
    scene.intersect(true); scene.nextFrame();
    scene.scroll(.3); scene.nextFrame();
    expect(createCloudRenderer).not.toHaveBeenCalled();
    scene.scroll(.7); scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenLastCalledWith(.7, 390, 800);
    expect(scene.container.querySelector('canvas')?.dataset.renderer).toBe('webgl');
    scene.scroll(.9); scene.nextFrame();
    scene.scroll(.7); scene.nextFrame();
    expect(draw.mock.calls).toEqual([[.7, 390, 800], [.9, 390, 800], [.7, 390, 800]]);
    scene.scroll(.2); scene.nextFrame();
    expect(draw).toHaveBeenCalledTimes(3);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling frames offscreen, in hidden tabs, and after unmount', () => {
    const scene = setupScrollScene();
    scene.intersect(true); scene.nextFrame();
    scene.scroll(.7); scene.nextFrame();
    expect(draw).toHaveBeenCalledTimes(1);
    // Cancel an already queued draw rather than merely ignoring later scrolls.
    scene.scroll(.8);
    scene.hide(true);
    scene.requestFrame.mockClear();
    scene.nextFrame();
    scene.scroll(.9); scene.nextFrame();
    expect(scene.requestFrame).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledTimes(1);
    scene.hide(false); scene.nextFrame();
    expect(draw).toHaveBeenLastCalledWith(.9, 390, 800);
    scene.intersect(false);
    scene.requestFrame.mockClear();
    scene.scroll(.6); scene.nextFrame();
    expect(scene.requestFrame).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledTimes(2);
    scene.intersect(true); scene.nextFrame();
    expect(draw).toHaveBeenLastCalledWith(.6, 390, 800);
    scene.unmount(); scene.requestFrame.mockClear(); scene.scroll(.3);
    expect(scene.requestFrame).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('retains the image fallback when WebGL initialization fails without retrying every scroll', () => {
    vi.mocked(createCloudRenderer).mockReturnValue(null);
    const scene = setupScrollScene();
    scene.intersect(true); scene.scroll(.7); scene.nextFrame();
    expect(scene.container.querySelector('canvas')?.dataset.renderer).toBe('fallback');
    expect(scene.container.querySelector('.journey-clouds img')).toBeTruthy();
    scene.scroll(.8); scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
  });

  it('falls back on context loss and restores the latest scroll frame when visible again', () => {
    const scene = setupScrollScene();
    scene.intersect(true); scene.scroll(.7); scene.nextFrame();
    const canvas = scene.container.querySelector('canvas')!;
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => { canvas.dispatchEvent(lost); });
    expect(lost.defaultPrevented).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(canvas.dataset.renderer).toBe('fallback');
    scene.scroll(.8); scene.nextFrame();
    expect(draw).toHaveBeenCalledTimes(1);
    const restoredDraw = vi.fn();
    const restoredDispose = vi.fn();
    vi.mocked(createCloudRenderer).mockReturnValue({ draw: restoredDraw, dispose: restoredDispose });
    scene.intersect(false);
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    scene.intersect(true); scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(2);
    expect(restoredDraw).toHaveBeenLastCalledWith(.8, 390, 800);
    expect(canvas.dataset.renderer).toBe('webgl');
    scene.unmount();
    expect(restoredDispose).toHaveBeenCalledTimes(1);
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(2);
  });

  it('keeps all live copy when decorative artwork fails', () => {
    const scene = setupScrollScene();
    scene.intersect(true); scene.nextFrame();
    fireEvent.error(scene.container.querySelector('.flight-airport img')!);
    expect(scene.container.querySelector('.flight-airport picture')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
  });

  it('switches to the compact composition when data saver changes during the visit', () => {
    const connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' });
    const unsubscribe = vi.spyOn(connection, 'removeEventListener');
    vi.stubGlobal('navigator', { connection });
    const scene = setupScrollScene();
    scene.intersect(true); scene.nextFrame();
    scene.scroll(.7); scene.nextFrame();
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    act(() => { connection.saveData = true; connection.dispatchEvent(new Event('change')); });
    expect(scene.container.querySelector('.static-journey')).toBeTruthy();
    expect(scene.container.querySelector('img, picture, video, canvas')).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
    scene.unmount();
    expect(unsubscribe).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
