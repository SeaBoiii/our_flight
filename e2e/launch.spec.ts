import { test, expect } from '@playwright/test';
import { comfortableTargets, noHorizontalOverflow, programmeDoesNotOverlap, unlock } from './helpers';
import { testCodes } from './test-config';

test('first-time guests can skip the journey and use browser history', async ({ page }) => {
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await page.locator('.experience-shortcuts a[href="#itinerary-title"]').click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('#itinerary-title')).toBeInViewport();
  await page.locator('.experience-shortcuts a[href="#rsvp"]').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await expect(page).toHaveURL(/#rsvp$/);
  await page.goBack();
  await expect(page).toHaveURL(/#itinerary-title$/);
  await expect(page.locator('.experience')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#rsvp$/);
  await page.getByRole('button', { name: 'Back to boarding pass', exact: true }).click();
  await expect(page.locator('#boarding-title')).toBeVisible();
});

test('blocked invitation chunk retains practical event details and recovery controls', async ({ page }) => {
  await page.route('**/components/InvitationExperience.tsx*', route => route.abort());
  await unlock(page, testCodes.BUSINESS);
  await page.reload();
  await page.getByRole('button', { name: 'Fast Track to Your Itinerary', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your invitation could not finish loading' })).toBeFocused();
  await expect(page.locator('.experience-recovery')).toContainText('21 August 2027');
  await expect(page.locator('.experience-recovery')).toContainText('22 August 2027');
  await expect(page.locator('.experience-recovery')).toContainText('75 Airport Boulevard');
  await expect(page.getByRole('link', { name: 'Add to calendar', exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Reload invitation', exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Back to boarding pass', exact: true }).click();
  await expect(page.locator('#boarding-title')).toBeVisible();
});

test('older browser APIs fall back to a readable invitation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined });
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = matchMedia(query);
      Object.defineProperty(media, 'addEventListener', { value: undefined });
      Object.defineProperty(media, 'removeEventListener', { value: undefined });
      return media;
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.locator('.experience-shortcuts a[href="#rsvp"]').click();
  await page.getByLabel('Your name', { exact: true }).fill('Compatibility Guest');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Compatibility Guest');
  expect(errors).toEqual([]);
});

test('360px Malay at 200 percent text keeps practical controls and details readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-standard', 'One enlarged-text layout check is sufficient.');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BUSINESS);
  await page.reload();
  await page.getByRole('button', { name: 'Fast Track to Your Itinerary', exact: true }).click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.locator('.experience-shortcuts a[href="#itinerary-title"]').click();
  await noHorizontalOverflow(page);
  await programmeDoesNotOverlap(page);
  await comfortableTargets(page.locator('.experience-nav a, .experience-nav button'));
  const nav = await page.locator('.experience-nav').boundingBox();
  const heading = await page.locator('#itinerary-title').boundingBox();
  expect(heading!.y).toBeGreaterThan(nav!.y + nav!.height);
  await page.locator('.experience-shortcuts a[href="#rsvp"]').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await noHorizontalOverflow(page);
  const headingText = await page.locator('#rsvp-title').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects()).map(({ left, right }) => ({ left, right }));
  });
  for (const rect of headingText) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(360);
  }
  await page.screenshot({ path: testInfo.outputPath('malay-200percent-rsvp.png') });
});
