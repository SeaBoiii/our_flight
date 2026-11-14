// A scroll-scrubbed film made of still frames. Frames are ordinary images drawn
// to a 2D canvas, so scrubbing never depends on video seeking (which stutters
// on iOS). Neighbouring frames are cross-faded, which lets a short sequence
// read as continuous motion at any scroll speed.
import { isLowDataConnection, networkConnection } from './network';
import { MOTION_MAX_WIDTH, takeoffFilm } from './sceneAssets';

export type FilmStrip = {
  /** Draws the film at `position` (0 = first frame, 1 = last). */
  draw: (position: number) => boolean;
  dispose: () => void;
};

type FilmSource = { frames: number; width: number; height: number; url: (index: number) => string };

/** Decoded frames kept either side of the playhead; the rest stay compressed. */
const WINDOW_BEHIND = 4;
const WINDOW_AHEAD = 6;
const EVICT_DISTANCE = 12;

/** Motion layers are for phones in portrait on a connection that can afford them. */
export function motionLayersAllowed(viewportWidth: number = window.innerWidth): boolean {
  if (viewportWidth > MOTION_MAX_WIDTH || isLowDataConnection()) return false;
  const network = networkConnection();
  return !network || !network.effectiveType || network.effectiveType === '4g';
}

const cache = new Map<string, Promise<HTMLImageElement[] | null>>();

/**
 * Downloads every frame once and shares the result between check-in preload
 * and the journey. Resolves to null if any frame is missing, so a partial film
 * is never shown: the journey keeps its still photograph instead.
 */
export function loadFilmFrames(source: FilmSource = takeoffFilm): Promise<HTMLImageElement[] | null> {
  const key = source.url(0);
  const existing = cache.get(key);
  if (existing) return existing;
  const base = import.meta.env.BASE_URL;
  const frames = Array.from({ length: source.frames }, (_unused, index) => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
    image.onerror = () => resolve(null);
    image.src = `${base}${source.url(index)}`;
  }));
  const loaded = Promise.all(frames).then((list) => (list.every(Boolean) ? (list as HTMLImageElement[]) : null));
  cache.set(key, loaded);
  return loaded;
}

export function createFilmStrip(canvas: HTMLCanvasElement, images: HTMLImageElement[], source: FilmSource = takeoffFilm): FilmStrip | null {
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas.getContext('2d', { alpha: false }); } catch { context = null; }
  if (!context || images.length < 2) return null;
  const surface = context;
  canvas.width = source.width;
  canvas.height = source.height;
  const last = images.length - 1;
  const bitmaps = new Map<number, ImageBitmap>();
  const pending = new Set<number>();
  let disposed = false;
  let previous = -1;

  const warm = (index: number) => {
    if (index < 0 || index > last || bitmaps.has(index) || pending.has(index) || typeof createImageBitmap !== 'function') return;
    pending.add(index);
    createImageBitmap(images[index]).then((bitmap) => {
      pending.delete(index);
      if (disposed) bitmap.close(); else bitmaps.set(index, bitmap);
    }).catch(() => { pending.delete(index); });
  };
  const frame = (index: number): CanvasImageSource => bitmaps.get(index) ?? images[index];

  return {
    draw(position) {
      if (disposed) return false;
      const clamped = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0)) * last;
      // Sixteenths of a frame are finer than the eye can follow.
      const key = Math.round(clamped * 16);
      if (key === previous) return true;
      previous = key;
      const index = Math.min(last, Math.floor(clamped));
      const blend = clamped - index;
      for (let offset = -WINDOW_BEHIND; offset <= WINDOW_AHEAD; offset++) warm(index + offset);
      for (const [stored, bitmap] of bitmaps) {
        if (Math.abs(stored - index) > EVICT_DISTANCE) { bitmap.close(); bitmaps.delete(stored); }
      }
      surface.globalAlpha = 1;
      surface.drawImage(frame(index), 0, 0, canvas.width, canvas.height);
      if (blend > 0.03 && index < last) {
        surface.globalAlpha = blend;
        surface.drawImage(frame(index + 1), 0, 0, canvas.width, canvas.height);
        surface.globalAlpha = 1;
      }
      canvas.dataset.frame = (clamped + 1).toFixed(2);
      return true;
    },
    dispose() {
      disposed = true;
      bitmaps.forEach((bitmap) => bitmap.close());
      bitmaps.clear();
      delete canvas.dataset.frame;
    },
  };
}
