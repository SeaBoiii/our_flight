import { describe, expect, it } from 'vitest';
import {
  getTicketFitScale,
  getWindowAperture,
  getWindowExitScale,
} from '../journeyMotion';

describe('airplane-window camera motion', () => {
  const pointIsInsideRoundedAperture = (
    x: number,
    y: number,
    aperture: ReturnType<typeof getWindowAperture>,
  ) => {
    const radiusX = aperture.width * 0.48;
    const radiusY = aperture.height * 0.18;
    const nearestCornerX = x < aperture.left + radiusX
      ? aperture.left + radiusX
      : aperture.right - radiusX;
    const nearestCornerY = y < aperture.top + radiusY
      ? aperture.top + radiusY
      : aperture.bottom - radiusY;
    const inHorizontalCorner = x < aperture.left + radiusX || x > aperture.right - radiusX;
    const inVerticalCorner = y < aperture.top + radiusY || y > aperture.bottom - radiusY;

    if (!inHorizontalCorner || !inVerticalCorner) return true;
    return (
      ((x - nearestCornerX) / radiusX) ** 2
      + ((y - nearestCornerY) / radiusY) ** 2
    ) <= 1;
  };

  it.each([
    [320, 800],
    [390, 844],
    [430, 932],
    [440, 956],
    [1440, 900],
  ])('zooms the real window beyond a %sx%s viewport', (width, height) => {
    const exitScale = getWindowExitScale(width, height);
    const aperture = getWindowAperture(width, height, exitScale);

    expect(exitScale).toBeGreaterThan(4);
    expect(aperture.left).toBeLessThanOrEqual(0);
    expect(aperture.right).toBeGreaterThanOrEqual(width);
    expect(aperture.top).toBeLessThanOrEqual(0);
    expect(aperture.bottom).toBeGreaterThanOrEqual(height);
    expect([
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].every(([x, y]) => pointIsInsideRoundedAperture(x, y, aperture))).toBe(true);
  });

  it('enlarges only the aperture geometry as the camera advances', () => {
    const initial = getWindowAperture(390, 844, 1);
    const advanced = getWindowAperture(390, 844, 3);

    expect(advanced.width).toBeCloseTo(initial.width * 3);
    expect(advanced.height).toBeCloseTo(initial.height * 3);
  });
});

describe('ticket stack viewport fit', () => {
  it.each([
    { slotWidth: 394, slotHeight: 570, ticketWidth: 500, ticketHeight: 820, preferredScale: 0.68 },
    { slotWidth: 404, slotHeight: 594, ticketWidth: 520, ticketHeight: 860, preferredScale: 0.68 },
    { slotWidth: 357, slotHeight: 390, ticketWidth: 500, ticketHeight: 900, preferredScale: 0.68 },
    { slotWidth: 324, slotHeight: 330, ticketWidth: 480, ticketHeight: 880, preferredScale: 0.68 },
  ])('keeps a complete two-pass stack inside a $slotWidth x $slotHeight slot', (dimensions) => {
    const scale = getTicketFitScale(dimensions);

    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(dimensions.preferredScale);
    expect(dimensions.ticketWidth * scale).toBeLessThanOrEqual(dimensions.slotWidth);
    expect(dimensions.ticketHeight * scale).toBeLessThanOrEqual(dimensions.slotHeight);
  });
});
