export type SceneVariant = {
  width: number;
  height: number;
  focalPoint: { x: number; y: number };
  webp: string;
  avif: string;
  window?: { left: number; right: number; top: number; bottom: number };
};

export type SceneAsset = { portrait: SceneVariant; landscape: SceneVariant };

// Geometry is normalized against the original artwork. Keeping it beside the
// asset dimensions ensures the CSS cover crop and camera use the same source.
export const sceneAssets: Record<'airport' | 'runway' | 'cabin' | 'sky', SceneAsset> = {
  airport: {
    portrait: { width: 1024, height: 1536, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/airport-portrait-640.webp', avif: 'flight/airport-portrait-640.avif' },
    landscape: { width: 1536, height: 1024, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/airport-landscape-1440.webp', avif: 'flight/airport-landscape-1440.avif' },
  },
  runway: {
    portrait: { width: 1536, height: 1024, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/runway-portrait-640.webp', avif: 'flight/runway-portrait-640.avif' },
    landscape: { width: 1536, height: 1024, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/runway-landscape-1440.webp', avif: 'flight/runway-landscape-1440.avif' },
  },
  cabin: {
    portrait: {
      width: 1024, height: 1536, focalPoint: { x: 0.5, y: 0.5 },
      webp: 'flight/cabin-portrait-768.webp', avif: 'flight/cabin-portrait-768.avif',
      window: { left: 0.235, right: 0.765, top: 0.130, bottom: 0.634 },
    },
    landscape: {
      width: 1536, height: 1024, focalPoint: { x: 0.5, y: 0.5 },
      webp: 'flight/cabin-landscape-1440.webp', avif: 'flight/cabin-landscape-1440.avif',
      window: { left: 0.323, right: 0.676, top: 0.097, bottom: 0.783 },
    },
  },
  sky: {
    portrait: { width: 1024, height: 1536, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/sky-portrait-768.webp', avif: 'flight/sky-portrait-768.avif' },
    landscape: { width: 1536, height: 1024, focalPoint: { x: 0.5, y: 0.5 }, webp: 'flight/sky-landscape-1440.webp', avif: 'flight/sky-landscape-1440.avif' },
  },
};

export function sceneVariant(asset: SceneAsset, viewportWidth: number): SceneVariant {
  return viewportWidth >= 768 ? asset.landscape : asset.portrait;
}
