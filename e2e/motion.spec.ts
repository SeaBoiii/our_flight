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
  expect(errors).toEqual([]);
});
