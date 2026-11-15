import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFilmStrip, motionLayersAllowed } from '../filmStrip';
import { getJourneyFrame } from '../journeyMotion';
import { takeoffFilm } from '../sceneAssets';

afterEach(() => vi.unstubAllGlobals());

function fakeCanvas() {
  const calls: Array<{ image: unknown; alpha: number }> = [];
  const context = { globalAlpha: 1, drawImage(image: unknown) { calls.push({ image, alpha: this.globalAlpha }); } };
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return { canvas, calls };
}
const frames = (count: number) => Array.from({ length: count }, () => new Image());

describe('take-off film strip', () => {
  it('names forty zero-padded portrait frames', () => {
    expect(takeoffFilm.frames).toBe(40);
    expect(takeoffFilm.url(0)).toBe('flight/takeoff/takeoff-portrait-01.webp');
    expect(takeoffFilm.url(39)).toBe('flight/takeoff/takeoff-portrait-40.webp');
  });

  it('draws the frame under the playhead and cross-fades towards the next', () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const { canvas, calls } = fakeCanvas();
    const images = frames(5);
    const strip = createFilmStrip(canvas, images)!;
    expect(canvas.width).toBe(takeoffFilm.width);
    expect(strip.draw(0)).toBe(true);
    expect(calls).toEqual([{ image: images[0], alpha: 1 }]);
    strip.draw(0.375); // frame 1.5 of 0..4
    expect(calls.slice(1)).toEqual([{ image: images[1], alpha: 1 }, { image: images[2], alpha: 0.5 }]);
    strip.draw(1);
    expect(calls.at(-1)).toEqual({ image: images[4], alpha: 1 });
    expect(canvas.dataset.frame).toBe('5.00');
  });

  it('skips repeated positions, clamps out-of-range input and stops after dispose', () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const { canvas, calls } = fakeCanvas();
    const strip = createFilmStrip(canvas, frames(4))!;
    strip.draw(0.5); strip.draw(0.5);
    const drawn = calls.length;
    strip.draw(Number.NaN);
    expect(canvas.dataset.frame).toBe('1.00');
    strip.draw(7);
    expect(canvas.dataset.frame).toBe('4.00');
    expect(calls.length).toBeGreaterThan(drawn);
    strip.dispose();
    expect(strip.draw(0.2)).toBe(false);
    expect(canvas.dataset.frame).toBeUndefined();
  });

  it('declines when the canvas has no 2D context or too few frames', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(createFilmStrip(canvas, frames(4))).toBeNull();
    expect(createFilmStrip(fakeCanvas().canvas, frames(1))).toBeNull();
  });
});

describe('motion layer eligibility', () => {
  it('is for phone-width screens on connections that can afford it', () => {
    vi.stubGlobal('navigator', {});
    expect(motionLayersAllowed(390)).toBe(true);
    expect(motionLayersAllowed(768)).toBe(false);
    vi.stubGlobal('navigator', { connection: { effectiveType: '3g' } });
    expect(motionLayersAllowed(390)).toBe(false);
    vi.stubGlobal('navigator', { connection: { saveData: true, effectiveType: '4g' } });
    expect(motionLayersAllowed(390)).toBe(false);
    vi.stubGlobal('navigator', { connection: { effectiveType: '4g' } });
    expect(motionLayersAllowed(430)).toBe(true);
  });
});

describe('motion layer storyboard', () => {
  const at = (progress: number) => getJourneyFrame(progress, 390, 844);

  it('scrubs the film across take-off and holds its last frame under the arriving cabin', () => {
    expect(at(0.1).filmOpacity).toBe(0);
    expect(at(0.165).filmPosition).toBe(0);
    expect(at(0.3).filmOpacity).toBe(1);
    expect(at(0.3).filmPosition).toBeGreaterThan(0.5);
    expect(at(0.405).filmPosition).toBe(1);
    expect(at(0.46).filmOpacity).toBe(1);
    expect(at(0.46).cabinOpacity).toBeLessThan(1);
    expect(at(0.48).cabinOpacity).toBe(1);
    expect(at(0.48).filmOpacity).toBe(0);
  });

  it('keeps the shade closed until the cabin is present and opens it before the camera moves', () => {
    expect(at(0.47).shadeOpen).toBe(0);
    expect(at(0.47).liveSkyOpacity).toBeGreaterThan(0);
    expect(at(0.475).liveSkyOpacity).toBe(1);
    expect(at(0.52).shadeOpen).toBeGreaterThan(0);
    expect(at(0.52).shadeOpen).toBeLessThan(1);
    expect(at(0.555).shadeOpen).toBe(1);
    expect(at(0.555).cameraScale).toBe(1);
  });

  it('fetches the arrival loop only once the window has opened, well before golden hour', () => {
    expect(at(0.05).assetTier).toBe(1);
    expect(at(0.3).assetTier).toBe(2);
    expect(at(0.555).assetTier).toBe(2);
    expect(at(0.56).assetTier).toBe(3);
    expect(at(0.56).goldenOpacity).toBe(0);
    expect(at(0.74).goldenOpacity).toBe(0);
  });

  it('rests the boarding pass flat until it is stamped, then banks it away in depth', () => {
    const rest = at(0);
    expect([rest.ticketPress, rest.ticketYaw, rest.ticketDepth, rest.ticketSheen]).toEqual([0, 0, -0, 0]);
    expect(rest.ticketRoll).toBe(-5);
    expect(at(0.055).ticketPress).toBeGreaterThan(0.5);
    expect(at(0.08).ticketPress).toBe(0);
    const leaving = at(0.18);
    expect(leaving.ticketYaw).toBe(22);
    expect(leaving.ticketDepth).toBe(-320);
    expect(leaving.ticketRoll).toBe(-14);
  });
});
