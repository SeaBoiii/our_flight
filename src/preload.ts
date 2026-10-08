// Hard-loads the cinematic journey while a first-time guest is at check-in.
// Guests spend 10–40 seconds entering their code, so the whole portrait (or
// landscape) journey, its code and the cloud shader can be fetched and decoded
// before they board. The files are the same public artwork every guest gets;
// nothing guest-specific is requested. Low-data visits request nothing.
import { aircraftAsset, sceneAssets, sceneVariant, waxSealAsset } from './sceneAssets';
import { isLowDataConnection } from './network';

const AVIF_PROBE = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

type LoadedImage = { src: string; image: HTMLImageElement; loaded: Promise<void> };

// Holding references keeps decoded bitmaps warm in the memory cache.
const images = new Map<string, LoadedImage>();
let chunks: Promise<unknown> | null = null;
let entries: Promise<LoadedImage[]> | null = null;
let shaderWarmed = false;
let openingDecoded = false;

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cinematicAllowed(): boolean {
  return !isLowDataConnection() && !reducedMotion() && typeof IntersectionObserver !== 'undefined';
}

function supportsAvif(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe.width > 0);
    probe.onerror = () => resolve(false);
    probe.src = AVIF_PROBE;
  });
}

function afterPageSettles(): Promise<void> {
  // Never compete with the check-in photograph (the LCP element).
  const settled = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
  return settled.then(() => new Promise<void>((resolve) => {
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => resolve(), { timeout: 400 });
    else window.setTimeout(resolve, 120);
  }));
}

/** The journey's artwork for this screen, in the order the scroll reveals it. */
export function journeyArtUrls(viewportWidth: number, avif: boolean): string[] {
  const base = import.meta.env.BASE_URL;
  const pick = (asset: (typeof sceneAssets)[keyof typeof sceneAssets]) => {
    const variant = sceneVariant(asset, viewportWidth);
    return `${base}${avif ? variant.avif : variant.webp}`;
  };
  return [
    pick(sceneAssets.airport),
    pick(sceneAssets.runway),
    `${base}${aircraftAsset}`,
    pick(sceneAssets.cabin),
    pick(sceneAssets.sky),
    pick(sceneAssets.golden),
    `${base}${waxSealAsset}`,
  ];
}

function load(src: string): LoadedImage {
  const existing = images.get(src);
  if (existing) return existing;
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });
  image.src = src;
  const entry = { src, image, loaded };
  images.set(src, entry);
  return entry;
}

/** Downloads the code for the invitation, the journey and GSAP. */
export function warmJourneyCode(): Promise<unknown> {
  chunks ??= Promise.all([
    import('./components/InvitationExperience'),
    import('./components/Journey'),
    import('./motion/gsap'),
  ]).catch(() => undefined);
  return chunks;
}

function journeyEntries(): Promise<LoadedImage[]> {
  if (!cinematicAllowed()) return Promise.resolve([]);
  entries ??= supportsAvif().then((avif) => journeyArtUrls(window.innerWidth, avif).map(load));
  return entries;
}

const decoded = (entry: LoadedImage) => entry.loaded
  .then(() => entry.image.decode?.())
  .catch(() => undefined);

/** Downloads every journey image for the current screen size. */
export function loadJourneyArt(): Promise<LoadedImage[]> {
  return journeyEntries().then((list) => Promise.all(list.map((entry) => entry.loaded)).then(() => list));
}

/** Check-in: fetch everything once the gate itself has rendered. */
export function preloadForCheckIn(): void {
  if (isLowDataConnection()) return;
  void afterPageSettles().then(() => {
    void warmJourneyCode();
    void loadJourneyArt();
  });
}

/** Returning guests start at the itinerary and only warm up on Replay intent. */
export function preloadForReplay(): void {
  if (isLowDataConnection()) return;
  void warmJourneyCode();
  void loadJourneyArt();
}

/** Boarding pass: decode the cached images and pre-compile the cloud shader. */
export function prepareForBoarding(): void {
  if (!cinematicAllowed()) return;
  void journeyEntries().then((list) => Promise.all(list.map(decoded)).then(() => { openingDecoded = true; }));
  if (shaderWarmed) return;
  shaderWarmed = true;
  window.setTimeout(() => {
    void import('./cloudRenderer').then(({ createCloudRenderer }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const renderer = createCloudRenderer(canvas);
      renderer?.draw(0.6, 32, 32);
      renderer?.dispose();
      canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
    }).catch(() => undefined); // The journey compiles the shader itself if warming fails.
  }, 250);
}

/**
 * Resolves when the opening scenes (airport, runway and aircraft) are decoded,
 * or after `timeout` ms, whichever is first. Boarding never waits longer.
 */
export function firstScenesReady(timeout = 1500): Promise<void> {
  if (openingScenesReady()) return Promise.resolve();
  const ready = journeyEntries()
    .then((list) => Promise.all(list.slice(0, 3).map(decoded)))
    .then(() => { openingDecoded = true; });
  return Promise.race([ready, new Promise<void>((resolve) => window.setTimeout(resolve, timeout))]);
}

/** Synchronous check used by the boarding timer. */
export function openingScenesReady(): boolean {
  return openingDecoded || !cinematicAllowed();
}
