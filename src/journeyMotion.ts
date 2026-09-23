import { sceneAssets, sceneVariant } from './sceneAssets';

export const JOURNEY_PHASES = {
  ticket: [0, 0.18],
  takeoff: [0.18, 0.40],
  cabin: [0.40, 0.56],
  window: [0.56, 0.82],
  arrival: [0.82, 1],
} as const;

export type WindowAperture = {
  left: number; right: number; top: number; bottom: number;
  width: number; height: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
export const phase = (value: number, start: number, end: number) => clamp((value - start) / (end - start));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function getWindowGeometry(viewportWidth: number, viewportHeight: number) {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const asset = sceneVariant(sceneAssets.cabin, width);
  const aperture = asset.window!;
  const scale = Math.max(width / asset.width, height / asset.height);
  const renderedWidth = asset.width * scale;
  const renderedHeight = asset.height * scale;
  const offsetX = (width - renderedWidth) * asset.focalPoint.x;
  const offsetY = (height - renderedHeight) * asset.focalPoint.y;
  const left = offsetX + aperture.left * renderedWidth;
  const right = offsetX + aperture.right * renderedWidth;
  const top = offsetY + aperture.top * renderedHeight;
  const bottom = offsetY + aperture.bottom * renderedHeight;
  return { left, right, top, bottom, width: right - left, height: bottom - top,
    originX: (left + right) / 2, originY: (top + bottom) / 2 };
}

export function getWindowAperture(viewportWidth: number, viewportHeight: number, cameraScale: number): WindowAperture {
  const geometry = getWindowGeometry(viewportWidth, viewportHeight);
  const zoom = Math.max(1, Number.isFinite(cameraScale) ? cameraScale : 1);
  const left = geometry.originX + (geometry.left - geometry.originX) * zoom;
  const right = geometry.originX + (geometry.right - geometry.originX) * zoom;
  const top = geometry.originY + (geometry.top - geometry.originY) * zoom;
  const bottom = geometry.originY + (geometry.bottom - geometry.originY) * zoom;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function getWindowExitScale(viewportWidth: number, viewportHeight: number): number {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const aperture = getWindowGeometry(width, height);
  // Carry the rounded corners clear of the screen before the cabin fades.
  return Math.max(1,
    aperture.originX / (aperture.width / 2),
    (width - aperture.originX) / (aperture.width / 2),
    aperture.originY / (aperture.height / 2),
    (height - aperture.originY) / (aperture.height / 2),
  ) * 1.35;
}

export function getJourneyFrame(rawProgress: number, viewportWidth: number, viewportHeight: number) {
  const progress = clamp(rawProgress);
  const chopLanding = smooth(phase(progress, 0.025, 0.060));
  const chopSettle = smooth(phase(progress, 0.060, 0.075));
  const ticket = smooth(phase(progress, 0.085, JOURNEY_PHASES.ticket[1]));
  const takeoff = smooth(phase(progress, ...JOURNEY_PHASES.takeoff));
  const camera = smooth(phase(progress, ...JOURNEY_PHASES.window));
  const arrival = smooth(phase(progress, ...JOURNEY_PHASES.arrival));
  return {
    progress,
    stampOpacity: phase(progress, 0.025, 0.040),
    stampScale: 1.75 - chopLanding * 0.83 + chopSettle * 0.08,
    stampRotate: -22 + chopLanding * 9,
    ticketY: -ticket * viewportHeight * 0.7,
    ticketRotate: ticket * -32,
    ticketOpacity: 1 - phase(progress, 0.10, 0.18),
    introOpacity: 1 - phase(progress, 0.07, 0.15),
    airportOpacity: 1 - phase(progress, 0.16, 0.26),
    departureOpacity: phase(progress, 0.16, 0.26) * (1 - phase(progress, 0.40, 0.48)),
    airportScale: 1 + takeoff * 0.08,
    aircraftOpacity: phase(progress, 0.15, 0.22) * (1 - phase(progress, 0.36, 0.43)),
    aircraftX: (takeoff * 0.85 - 0.48) * viewportWidth,
    aircraftY: (0.20 - takeoff * 0.44) * viewportHeight,
    aircraftScale: 0.76 + takeoff * 0.42,
    takeoffCopyOpacity: phase(progress, 0.19, 0.23) * (1 - phase(progress, 0.33, 0.39)),
    cabinOpacity: phase(progress, 0.39, 0.47) * (1 - phase(progress, 0.80, 0.85)),
    cabinCopyOpacity: phase(progress, 0.44, 0.48) * (1 - phase(progress, 0.55, 0.59)),
    cameraScale: 1 + (getWindowExitScale(viewportWidth, viewportHeight) - 1) * camera,
    skyOpacity: phase(progress, 0.55, 0.61),
    revealOpacity: phase(progress, 0.85, 0.95),
    revealY: (1 - arrival) * 36,
    daylightOpacity: phase(progress, 0.91, 1),
    // Prefetch the next scene early, without requesting the entire journey at boarding.
    assetTier: progress >= 0.075 ? 2 : 1,
  };
}
