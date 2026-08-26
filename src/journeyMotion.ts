const CABIN_SOURCE_WIDTH = 1024;
const CABIN_SOURCE_HEIGHT = 1536;
const WINDOW_ORIGIN_X = 0.51;
const WINDOW_ORIGIN_Y = 0.34;

// Inner edge of the photographed window, measured from the 768 x 1152 master.
const WINDOW_APERTURE = {
  left: CABIN_SOURCE_WIDTH * (316 / 768),
  right: CABIN_SOURCE_WIDTH * (468 / 768),
  top: CABIN_SOURCE_HEIGHT * (241 / 1152),
  bottom: CABIN_SOURCE_HEIGHT * (543 / 1152),
};

export type WindowAperture = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type WindowGeometry = WindowAperture & {
  originX: number;
  originY: number;
};

function getWindowGeometry(viewportWidth: number, viewportHeight: number): WindowGeometry {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const coverScale = Math.max(
    safeWidth / CABIN_SOURCE_WIDTH,
    safeHeight / CABIN_SOURCE_HEIGHT,
  );
  const renderedWidth = CABIN_SOURCE_WIDTH * coverScale;
  const renderedHeight = CABIN_SOURCE_HEIGHT * coverScale;
  const offsetX = (safeWidth - renderedWidth) * WINDOW_ORIGIN_X;
  const offsetY = (safeHeight - renderedHeight) * WINDOW_ORIGIN_Y;
  const left = offsetX + WINDOW_APERTURE.left * coverScale;
  const right = offsetX + WINDOW_APERTURE.right * coverScale;
  const top = offsetY + WINDOW_APERTURE.top * coverScale;
  const bottom = offsetY + WINDOW_APERTURE.bottom * coverScale;

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    originX: safeWidth * WINDOW_ORIGIN_X,
    originY: safeHeight * WINDOW_ORIGIN_Y,
  };
}

/**
 * Returns the photographed window aperture after the cabin camera has zoomed.
 * The cloud plane is deliberately not part of this transform.
 */
export function getWindowAperture(
  viewportWidth: number,
  viewportHeight: number,
  cameraScale: number,
): WindowAperture {
  const geometry = getWindowGeometry(viewportWidth, viewportHeight);
  const throughCamera = (coordinate: number, origin: number) =>
    origin + (coordinate - origin) * cameraScale;
  const left = throughCamera(geometry.left, geometry.originX);
  const right = throughCamera(geometry.right, geometry.originX);
  const top = throughCamera(geometry.top, geometry.originY);
  const bottom = throughCamera(geometry.bottom, geometry.originY);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Calculates the zoom needed for the real window opening to pass every edge of
 * the viewport. A small overscan keeps the cabin frame from lingering onscreen.
 */
export function getWindowExitScale(
  viewportWidth: number,
  viewportHeight: number,
): number {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const geometry = getWindowGeometry(safeWidth, safeHeight);
  const edgeScales = [
    geometry.originX / Math.max(1, geometry.originX - geometry.left),
    (safeWidth - geometry.originX) / Math.max(1, geometry.right - geometry.originX),
    geometry.originY / Math.max(1, geometry.originY - geometry.top),
    (safeHeight - geometry.originY) / Math.max(1, geometry.bottom - geometry.originY),
  ];

  // The extra distance carries the aperture's rounded corners—not only its
  // straight edges—past the screen before the cabin layer fades away.
  return Math.max(1, ...edgeScales) * 1.2;
}
