import { describe, expect, it } from 'vitest';
import { getJourneyFrame, getWindowAperture, getWindowExitScale, getWindowGeometry, JOURNEY_PHASES } from '../journeyMotion';
import { sceneAssets } from '../sceneAssets';

describe('airplane-window camera geometry', () => {
  const insideRoundedAperture = (x: number, y: number, aperture: ReturnType<typeof getWindowAperture>) => {
    const rx = aperture.width * .48;
    const ry = aperture.height * .18;
    const cx = x < aperture.left + rx ? aperture.left + rx : aperture.right - rx;
    const cy = y < aperture.top + ry ? aperture.top + ry : aperture.bottom - ry;
    if (!(x < aperture.left + rx || x > aperture.right - rx) || !(y < aperture.top + ry || y > aperture.bottom - ry)) return true;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  };

  it.each([[320, 800], [390, 844], [430, 932], [768, 1024], [844, 390], [1440, 900]])(
    'carries every rounded window corner beyond the %sx%s viewport', (width, height) => {
      const scale = getWindowExitScale(width, height);
      const aperture = getWindowAperture(width, height, scale);
      expect(scale).toBeGreaterThan(1);
      expect(aperture.left).toBeLessThanOrEqual(0);
      expect(aperture.right).toBeGreaterThanOrEqual(width);
      expect(aperture.top).toBeLessThanOrEqual(0);
      expect(aperture.bottom).toBeGreaterThanOrEqual(height);
      expect([[0, 0], [width, 0], [0, height], [width, height]].every(([x, y]) => insideRoundedAperture(x, y, aperture))).toBe(true);
    },
  );

  it('anchors the camera to the photographed window center across responsive artwork', () => {
    for (const width of [390, 1440]) {
      const geometry = getWindowGeometry(width, 844);
      const aperture = getWindowAperture(width, 844, 3);
      expect((aperture.left + aperture.right) / 2).toBeCloseTo(geometry.originX);
      expect((aperture.top + aperture.bottom) / 2).toBeCloseTo(geometry.originY);
      expect(aperture.width).toBeCloseTo(geometry.width * 3);
      expect(aperture.height).toBeCloseTo(geometry.height * 3);
    }
    expect(sceneAssets.cabin.portrait.window).not.toEqual(sceneAssets.cabin.landscape.window);
  });
});

describe('five-phase scroll storyboard', () => {
  it('keeps the approved phase boundaries and exposes each key composition', () => {
    expect(Object.values(JOURNEY_PHASES)).toEqual([[0, .18], [.18, .4], [.4, .56], [.56, .82], [.82, 1]]);
    const opening = getJourneyFrame(0, 390, 844);
    expect(opening.ticketOpacity).toBe(1);
    expect(opening.cabinOpacity).toBe(0);
    const takeoff = getJourneyFrame(.3, 390, 844);
    expect(takeoff.aircraftOpacity).toBe(1);
    expect(takeoff.departureOpacity).toBe(1);
    expect(takeoff.airportOpacity).toBe(0);
    const cabin = getJourneyFrame(.5, 390, 844);
    expect(cabin.cabinOpacity).toBe(1);
    expect(cabin.cameraScale).toBe(1);
    const window = getJourneyFrame(.7, 390, 844);
    expect(window.cameraScale).toBeGreaterThan(1);
    expect(window.skyOpacity).toBe(1);
    const arrival = getJourneyFrame(1, 390, 844);
    expect(arrival.revealOpacity).toBe(1);
    expect(arrival.daylightOpacity).toBe(1);
    expect(arrival.cabinOpacity).toBe(0);
  });

  it('produces identical frames when scrolling backwards and clamps browser overscroll', () => {
    const first = getJourneyFrame(.3, 390, 844);
    getJourneyFrame(.9, 390, 844);
    expect(getJourneyFrame(.3, 390, 844)).toEqual(first);
    expect(getJourneyFrame(-1, 390, 844)).toEqual(getJourneyFrame(0, 390, 844));
    expect(getJourneyFrame(2, 390, 844)).toEqual(getJourneyFrame(1, 390, 844));
  });

  it('lands and settles the chop before lifting the ticket, with no time dependency', () => {
    const frame = (progress: number) => getJourneyFrame(progress, 390, 844);
    expect(frame(0).stampOpacity).toBe(0);
    expect(frame(.025).stampOpacity).toBe(0);
    expect(frame(.04).stampOpacity).toBe(1);
    expect(frame(.04).stampScale).toBeGreaterThan(1);
    expect(frame(.06).stampScale).toBeCloseTo(.92);
    expect(frame(.075).stampScale).toBeCloseTo(1);
    expect(frame(.075).stampRotate).toBe(-13);
    expect(frame(.085).ticketY).toBeCloseTo(0);
    expect(frame(.085).ticketOpacity).toBe(1);
    expect(frame(.12).ticketY).toBeLessThan(0);
    expect(frame(.12).stampOpacity).toBe(1);
    expect(frame(.18).ticketOpacity).toBe(0);

    const landing = frame(.05);
    frame(.18);
    expect(frame(.05)).toEqual(landing);
    expect(frame(0).stampOpacity).toBe(0);
  });
});
