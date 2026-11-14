import { expect, test, type Locator } from '@playwright/test';
import { unlock, noHorizontalOverflow, withoutMotionLayers } from './helpers';

async function scrollJourney(journey: Locator, progress: number) {
  await expect.poll(() => journey.evaluate((element, value) => {
    const stage = element.querySelector('.journey-stage') as HTMLElement;
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + (element.clientHeight - stage.clientHeight) * value, behavior: 'instant' });
    return Number(element.style.getPropertyValue('--journey-progress'));
  }, progress)).toBeCloseTo(progress, 2);
}

async function board(page: Parameters<typeof unlock>[0]) {
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  return journey;
}

test('take-off film scrubs with scroll in both directions and replaces the cut-out aircraft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const journey = await board(page);
  await expect(journey).toHaveClass(/journey--film/);
  const film = journey.locator('canvas.flight-film');
  await scrollJourney(journey, .30);
  await expect(journey.locator('.flight-aircraft')).toBeHidden();
  const frame = () => film.getAttribute('data-frame').then(Number);
  await expect.poll(frame).toBeGreaterThan(15);
  const middle = await frame();
  // The canvas holds real pixels, not an empty buffer.
  expect(await film.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height * .9, 1, 1).data;
    return pixel[0] + pixel[1] + pixel[2];
  })).toBeGreaterThan(0);
  await scrollJourney(journey, .38);
  await expect.poll(frame).toBeGreaterThan(middle);
  await scrollJourney(journey, .22);
  await expect.poll(frame).toBeLessThan(middle);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('the window shade lifts on a living sky that carries through the window', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const journey = await board(page);
  await scrollJourney(journey, .47);
  const video = journey.locator('video.flight-sky-live');
  await expect(video).toHaveCount(1);
  await expect(journey).toHaveClass(/journey--live-sky/);
  expect(await journey.evaluate(el => Number(el.style.getPropertyValue('--shade-open')))).toBe(0);
  await expect(video).toHaveJSProperty('muted', true);
  await scrollJourney(journey, .56);
  expect(await journey.evaluate(el => Number(el.style.getPropertyValue('--shade-open')))).toBe(1);
  await expect(video).toHaveJSProperty('paused', false);
  // The WebGL clouds stay asleep while the film of the sky is playing.
  await scrollJourney(journey, .70);
  await expect(journey.locator('canvas.flight-cloud-volume')).not.toHaveAttribute('data-renderer');
  // Behind the opaque golden-hour sky the loop is paused to save battery.
  await scrollJourney(journey, .96);
  await expect(video).toHaveJSProperty('paused', true);
  await scrollJourney(journey, .60);
  await expect(video).toHaveJSProperty('paused', false);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('the arrival sky is alive behind the monogram and rests out of view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const journey = await board(page);
  // The loop is fetched once the window has opened, and waits paused.
  await scrollJourney(journey, .40);
  await expect(journey.locator('video.flight-golden-live')).toHaveCount(0);
  await scrollJourney(journey, .60);
  const video = journey.locator('video.flight-golden-live');
  await expect(video).toHaveCount(1);
  await expect(journey).toHaveClass(/journey--live-golden/);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('paused', true);
  await scrollJourney(journey, .96);
  await expect(video).toHaveJSProperty('paused', false);
  await expect(video).toHaveCSS('opacity', '1');
  await expect(journey.locator('.journey-reveal img')).toBeVisible();
  await scrollJourney(journey, .60);
  await expect(video).toHaveJSProperty('paused', true);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('without the motion layers the original journey still flies', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await withoutMotionLayers(page);
  const journey = await board(page);
  await scrollJourney(journey, .30);
  await expect(journey).not.toHaveClass(/journey--film/);
  await expect(journey.locator('.flight-aircraft')).toBeVisible();
  await scrollJourney(journey, .70);
  await expect(journey.locator('video')).toHaveCount(0);
  await expect(journey).not.toHaveClass(/journey--live-sky/);
  await expect(journey.locator('canvas.flight-cloud-volume')).toHaveAttribute('data-renderer', /webgl|fallback/);
  await scrollJourney(journey, .96);
  await expect(journey.locator('video')).toHaveCount(0);
  await expect(journey).not.toHaveClass(/journey--live-golden/);
  await expect(journey.locator('.flight-golden img')).toBeVisible();
  expect(errors).toEqual([]);
});

async function scrollThrough(scene: Locator, progress: number) {
  await scene.evaluate((element, value) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + Math.max(0, element.clientHeight - window.innerHeight) * value, behavior: 'instant' });
  }, progress);
}

test('the envelope opens on its night-sky liner and the boarding-pass card rises', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await board(page);
  const scene = page.locator('.envelope-scene');
  await scrollThrough(scene, 0);
  // The photographs arrive as the scene draws near.
  await expect(scene).toHaveClass(/envelope-scene--art/);
  const card = scene.locator('.envelope-card');
  const arch = scene.locator('.envelope-card-arch');
  await expect(arch).toHaveJSProperty('complete', true);
  expect(await arch.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(scene.locator('.envelope-seal')).toBeVisible();
  const resting = (await card.boundingBox())!.y;
  await scrollThrough(scene, 0.62);
  // The flap has turned over and the card has risen out of the pocket.
  await expect.poll(async () => (await card.boundingBox())!.y).toBeLessThan(resting - 80);
  await expect.poll(() => scene.locator('.envelope-flap').evaluate(flap => getComputedStyle(flap).transform)).toMatch(/^matrix3d\(1, 0, 0, 0, 0, -1/);
  await expect(card).toContainText('Aleem');
  await expect(card).toContainText('SIN');
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('the venue map draws the walk from the MRT to Crowne Plaza over a living model', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await board(page);
  const map = page.locator('.venue-map');
  await map.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.95, behavior: 'instant' }));
  await expect(map.locator('.venue-map-stop.is-reached')).toHaveCount(0);
  await map.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' }));
  await expect(map.locator('.venue-map-stop.is-reached')).toHaveCount(3);
  await expect(map.locator('.venue-map-step.is-reached')).toHaveCount(3);
  await expect(map.locator('.venue-map-step')).toHaveText(['1Changi Airport MRT', '2Terminal 3', '3Crowne Plaza']);
  const loop = map.locator('video.venue-map-loop');
  await expect(loop).toHaveCount(1);
  await expect(map).toHaveClass(/venue-map--live/);
  await expect(loop).toHaveJSProperty('muted', true);
  await expect(loop).toHaveJSProperty('paused', false);
  // Out of view, the loop rests.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(loop).toHaveJSProperty('paused', true);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('the venue map keeps its still and its full route when the loop cannot load', async ({ page }) => {
  await page.route(/\/flight\/venue-map-loop\.mp4/, route => route.abort());
  await board(page);
  const map = page.locator('.venue-map');
  await map.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' }));
  await expect(map.locator('.venue-map-stop.is-reached')).toHaveCount(3);
  await expect(map.locator('video')).toHaveCount(0);
  await expect(map).not.toHaveClass(/venue-map--live/);
  await expect(map.locator('img')).toBeVisible();
});
