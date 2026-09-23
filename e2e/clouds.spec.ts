import { expect, test, type Locator } from '@playwright/test';
import { unlock, noHorizontalOverflow } from './helpers';

async function scrollCloudProgress(journey: Locator, progress: number) {
  await journey.evaluate((element, value) => {
    const stage = element.querySelector('.journey-stage') as HTMLElement;
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + (element.clientHeight - stage.clientHeight) * value, behavior: 'instant' });
  }, progress);
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--journey-progress')))).toBeCloseTo(progress, 2);
}

async function expectPaintedCloudFramebuffer(canvas: Locator) {
  // Renderer attributes can survive a cleared drawing buffer. Read the actual
  // retained GPU pixels so resize/context recovery cannot silently show black.
  await expect.poll(() => canvas.evaluate(element => {
    const node = element as HTMLCanvasElement;
    const gl = node.getContext('webgl');
    if (!gl || gl.isContextLost()) return 0;
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[0] + pixel[1] + pixel[2];
  }), { message: 'Cloud framebuffer must contain rendered RGB pixels, not a cleared black buffer' }).toBeGreaterThan(30);
}

test('three-dimensional clouds fit every aspect ratio and reverse with scrolling', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.ticket-stack--scanning')).toBeVisible();
  await expect(page.locator('.boarding-stamp--visible')).toHaveCount(0);
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120); // Let entry scroll restoration settle before driving the scene.
  const canvas = journey.locator('canvas');
  await expect(canvas).not.toHaveAttribute('data-renderer');
  await scrollCloudProgress(journey, .075);
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--ticket-chop-opacity')))).toBe(1);
  await expect.poll(() => journey.evaluate(el => Number.parseFloat(el.style.getPropertyValue('--ticket-y')))).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('ticket-chop-scroll.png') });
  await scrollCloudProgress(journey, 0);
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--ticket-chop-opacity')))).toBe(0);
  for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    for (const progress of [.68, .80, .91, .72]) {
      await scrollCloudProgress(journey, progress);
      await expect(canvas).toHaveAttribute('data-renderer', /webgl|fallback/);
      const renderer = await canvas.getAttribute('data-renderer');
      if (renderer === 'webgl') {
        await expect(canvas).toHaveAttribute('data-rendered', 'true');
        await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeCloseTo(progress, 2);
        await expectPaintedCloudFramebuffer(canvas);
      } else if (testInfo.project.name === 'design-chromium') throw new Error('Chromium must exercise the real volume renderer');
      await noHorizontalOverflow(page);
      await expect.poll(() => journey.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cloud-${width}-${progress}-${renderer}.png`) });
    }
  }
  await expect(page.locator('.flight-foreground-clouds')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('unavailable WebGL leaves a readable sky and usable navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120); // Match the cinematic test's entry-restoration settling period.
  await scrollCloudProgress(journey, .72);
  await expect(journey.locator('canvas')).toHaveAttribute('data-renderer', 'fallback');
  await expect(journey.locator('canvas')).not.toHaveAttribute('data-rendered');
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
});

test('lost WebGL context falls back, restores the current clouds, and keeps RSVP reachable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  await scrollCloudProgress(journey, .72);
  const canvas = journey.locator('canvas');
  await expect(canvas).toHaveAttribute('data-renderer', /webgl|fallback/);
  const renderer = await canvas.getAttribute('data-renderer');
  if (testInfo.project.name === 'design-chromium') expect(renderer).toBe('webgl');
  test.skip(renderer !== 'webgl', 'This browser exposes only the image fallback, so no GPU context can be lost.');
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  await expectPaintedCloudFramebuffer(canvas);
  const extension = await canvas.evaluateHandle(element => (element as HTMLCanvasElement).getContext('webgl')?.getExtension('WEBGL_lose_context'));
  const extensionAvailable = await extension.evaluate(value => Boolean(value));
  test.skip(!extensionAvailable, 'WEBGL_lose_context is unavailable in this browser.');

  try {
    await extension.evaluate(value => value!.loseContext());
    await expect(canvas).toHaveAttribute('data-renderer', 'fallback');
    await expect(canvas).not.toHaveAttribute('data-rendered');
    const fallback = journey.locator('.journey-clouds img');
    await expect(fallback).toHaveJSProperty('complete', true);
    await expect(fallback).not.toHaveJSProperty('naturalWidth', 0);
    await scrollCloudProgress(journey, .80);
    await expect(canvas).toHaveAttribute('data-renderer', 'fallback');

    await extension.evaluate(value => value!.restoreContext());
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    await expect(canvas).toHaveAttribute('data-rendered', 'true');
    await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeCloseTo(.80, 2);
    await expectPaintedCloudFramebuffer(canvas);
    await scrollCloudProgress(journey, .68);
    await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeCloseTo(.68, 2);
    await expectPaintedCloudFramebuffer(canvas);
    await noHorizontalOverflow(page);
    await page.locator('.itinerary-rsvp').click();
    await expect(page.locator('#rsvp-title')).toBeFocused();
    await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await extension.dispose();
  }
});
