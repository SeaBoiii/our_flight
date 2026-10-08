import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Journey } from '../components/Journey';
import { createCloudRenderer } from '../cloudRenderer';
import { invitationWith } from './fixtures';

type Trigger = {
  progress: number;
  reverted?: boolean;
  trigger?: Element;
  start?: string;
  end?: string;
  onUpdate?: (self: Trigger) => void;
  onRefresh?: (self: Trigger) => void;
};
const motion = vi.hoisted(() => ({ triggers: [] as Trigger[] }));

vi.mock('../cloudRenderer', () => ({ createCloudRenderer: vi.fn() }));
// GSAP is the journey's scroll driver. The mock exposes the driving trigger so
// tests can scrub progress exactly as ScrollTrigger reports it.
vi.mock('../motion/gsap', () => {
  const chain: Record<string, unknown> = new Proxy({}, { get: (_target, key) => (key === 'then' ? undefined : () => chain) });
  return {
    gsap: {
      context: (setup: () => void) => {
        const before = motion.triggers.length;
        setup();
        const created = motion.triggers.slice(before);
        return { revert: () => created.forEach((trigger) => { trigger.reverted = true; }) };
      },
      timeline: () => chain,
    },
    ScrollTrigger: {
      create: (config: Omit<Trigger, 'progress'>) => {
        const trigger: Trigger = { ...config, progress: 0 };
        motion.triggers.push(trigger);
        return trigger;
      },
    },
    SplitText: { create: () => ({ lines: [] }) },
  };
});

let draw = vi.fn();
let dispose = vi.fn();
beforeEach(() => {
  motion.triggers.length = 0;
  draw = vi.fn();
  dispose = vi.fn();
  vi.mocked(createCloudRenderer).mockReset().mockReturnValue({ draw, dispose });
  vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => vi.unstubAllGlobals());

function setupScrollScene() {
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const rendered = render(<Journey invitation={invitationWith(2)} locale="en" reducedMotion={false} />);
  const section = rendered.container.querySelector<HTMLElement>('.journey')!;
  const stage = rendered.container.querySelector<HTMLElement>('.journey-stage')!;
  Object.defineProperties(stage, { clientWidth: { value: 390 }, clientHeight: { value: 800 } });
  const driver = () => motion.triggers.find((trigger) => trigger.onUpdate && !trigger.reverted)!;
  return {
    ...rendered, section, driver,
    refresh: () => act(() => { const trigger = driver(); trigger.onRefresh?.(trigger); }),
    scroll: (progress: number) => act(() => { const trigger = driver(); trigger.progress = progress; trigger.onUpdate?.(trigger); }),
    hide: (value: boolean) => act(() => { hidden = value; }),
  };
}

describe('compact static journey', () => {
  it('retains a personalised ceremonial ticket in the automatic reduced-motion composition', () => {
    const { container } = render(<Journey invitation={invitationWith()} locale="en" reducedMotion guestName="  Aisyah & Family  " />);
    expect(container.querySelector('.ceremonial-ticket-label')?.textContent).toBe('Aisyah & Family');
    expect(container.querySelector('.ceremonial-ticket-names')?.textContent).toBe('Aleem & Nurulain');
    expect(container.querySelector('img, picture, video, canvas')).toBeNull();
  });

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
  it('drives every layer from one ScrollTrigger spanning the sticky journey', () => {
    const scene = setupScrollScene();
    const trigger = scene.driver();
    expect(trigger.trigger).toBe(scene.section);
    expect(trigger.start).toBe('top top');
    expect(trigger.end).toBe('bottom bottom');
  });

  it('mounts image layers progressively and retains them for reverse scrolling', () => {
    const scene = setupScrollScene();
    expect(scene.container.querySelector('.flight-airport img')).toBeNull();
    scene.refresh();
    expect(scene.container.querySelector('.flight-airport img')).toBeTruthy();
    expect(scene.container.querySelector('.flight-departure img')).toBeTruthy();
    expect(scene.container.querySelector('.journey-cabin img')).toBeNull();
    scene.scroll(.1);
    expect(scene.container.querySelector('.journey-cabin img')).toBeTruthy();
    expect(scene.container.querySelector('.journey-clouds img')).toBeTruthy();
    expect(scene.container.querySelector('.flight-golden img')).toBeTruthy();
    expect(createCloudRenderer).not.toHaveBeenCalled();
    scene.scroll(.5);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    scene.scroll(0);
    expect(scene.section.style.getPropertyValue('--ticket-opacity')).toBe('1');
    expect(scene.container.querySelector('.journey-cabin img')).toBeTruthy();
    expect(scene.container.querySelector('video')).toBeNull();
  });

  it('initializes near the cloud scene, draws its current frame immediately, and follows reverse scrolling', () => {
    const scene = setupScrollScene();
    scene.refresh();
    scene.scroll(.3);
    expect(createCloudRenderer).not.toHaveBeenCalled();
    scene.scroll(.7);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenLastCalledWith(.7, 390, 800);
    expect(scene.container.querySelector('canvas')?.dataset.renderer).toBe('webgl');
    scene.scroll(.8);
    scene.scroll(.7);
    expect(draw.mock.calls).toEqual([[.7, 390, 800], [.8, 390, 800], [.7, 390, 800]]);
    scene.scroll(.2);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
  });

  it('stops drawing clouds behind the golden-hour sky, in hidden tabs, and after unmount', () => {
    const scene = setupScrollScene();
    scene.refresh();
    scene.scroll(.7);
    expect(draw).toHaveBeenCalledTimes(1);
    scene.scroll(.95);
    expect(scene.section.style.getPropertyValue('--golden-opacity')).toBe('1');
    expect(draw).toHaveBeenCalledTimes(1);
    scene.hide(true);
    scene.scroll(.75);
    expect(draw).toHaveBeenCalledTimes(1);
    scene.hide(false);
    scene.scroll(.76);
    expect(draw).toHaveBeenLastCalledWith(.76, 390, 800);
    const driver = scene.driver();
    scene.unmount();
    expect(driver.reverted).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('retains the image fallback when WebGL initialization fails without retrying every scroll', () => {
    vi.mocked(createCloudRenderer).mockReturnValue(null);
    const scene = setupScrollScene();
    scene.refresh(); scene.scroll(.7);
    expect(scene.container.querySelector('canvas')?.dataset.renderer).toBe('fallback');
    expect(scene.container.querySelector('.journey-clouds img')).toBeTruthy();
    scene.scroll(.8);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
  });

  it('falls back on context loss and restores the latest scroll frame', () => {
    const scene = setupScrollScene();
    scene.refresh(); scene.scroll(.7);
    const canvas = scene.container.querySelector('canvas')!;
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => { canvas.dispatchEvent(lost); });
    expect(lost.defaultPrevented).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(canvas.dataset.renderer).toBe('fallback');
    scene.scroll(.8);
    expect(draw).toHaveBeenCalledTimes(1);
    const restoredDraw = vi.fn();
    const restoredDispose = vi.fn();
    vi.mocked(createCloudRenderer).mockReturnValue({ draw: restoredDraw, dispose: restoredDispose });
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    expect(createCloudRenderer).toHaveBeenCalledTimes(2);
    expect(restoredDraw).toHaveBeenLastCalledWith(.8, 390, 800);
    expect(canvas.dataset.renderer).toBe('webgl');
    scene.unmount();
    expect(restoredDispose).toHaveBeenCalledTimes(1);
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    expect(createCloudRenderer).toHaveBeenCalledTimes(2);
  });

  it('keeps all live copy when decorative artwork fails', () => {
    const scene = setupScrollScene();
    scene.refresh();
    fireEvent.error(scene.container.querySelector('.flight-airport img')!);
    expect(scene.container.querySelector('.flight-airport picture')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeTruthy();
  });

  it('switches to the compact composition when data saver changes during the visit', () => {
    const connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' });
    const unsubscribe = vi.spyOn(connection, 'removeEventListener');
    vi.stubGlobal('navigator', { connection });
    const scene = setupScrollScene();
    scene.refresh();
    scene.scroll(.7);
    expect(createCloudRenderer).toHaveBeenCalledTimes(1);
    act(() => { connection.saveData = true; connection.dispatchEvent(new Event('change')); });
    expect(scene.container.querySelector('.static-journey')).toBeTruthy();
    expect(scene.container.querySelector('img, picture, video, canvas')).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
    scene.unmount();
    expect(unsubscribe).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
