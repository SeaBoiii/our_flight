import { test, expect } from '@playwright/test';
import { cardTextDoesNotClipOrOverlap, comfortableTargets, fillRsvp, mockRsvpBridge, noHorizontalOverflow, openJourney, programmeDoesNotOverlap, showBoarding, unlock, type SubmittedPayload } from './helpers';
import { testCodes, testEndpoint } from './test-config';

test('first and returning visits preserve their own Back and browser-history destinations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page);
  await expect(page.locator('.boarding-fast-track')).toHaveCount(0);
  await expect(page.locator('.guest-overview, .experience-shortcuts')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simple view', exact: true })).toHaveCount(0);
  await openJourney(page);
  await expect(page.locator('.experience-nav a')).toHaveCount(0);
  await expect(page.locator('.experience-back')).toHaveAccessibleName('Back to boarding pass');
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await expect(page).toHaveURL(/#rsvp$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/#rsvp$/);
  await expect(page.locator('.experience--journey')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#boarding-title')).toBeFocused();
  await page.goForward();
  await expect(page.locator('.experience--journey')).toBeVisible();
  await page.locator('.experience-back').click();
  await expect(page.locator('#boarding-title')).toBeFocused();
  await page.goForward();
  await expect(page.locator('.experience--journey')).toBeVisible();

  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back.');
  await expect(page.locator('.journey, .static-journey, .guest-overview, .experience-shortcuts')).toHaveCount(0);
  await openJourney(page);
  await expect(page.locator('.experience-back')).toHaveAccessibleName('Back to itinerary');
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await page.locator('.experience-back').click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('.experience--fast-track')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.experience--journey')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#rsvp$/);
  await page.goBack();
  await expect(page.locator('.experience--journey')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await showBoarding(page);
  await expect(page.locator('.boarding-fast-track')).toHaveText('Back to itinerary');
  await page.locator('.boarding-fast-track').click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
});

test('blocked invitation chunk retains practical event details and recovery controls', async ({ page }) => {
  await page.route('**/components/InvitationExperience.tsx*', route => route.abort());
  await unlock(page, testCodes.BUSINESS);
  await page.locator('.ticket-scan-action').click();
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
  await openJourney(page);
  await expect(page.locator('.static-journey')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.locator('.itinerary-rsvp').click();
  await page.getByLabel('Your name', { exact: true }).fill('Compatibility Guest');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Compatibility Guest');
  expect(errors).toEqual([]);
});

test('320px Malay at 200 percent text keeps practical controls and details readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', 'One enlarged-text layout check is sufficient.');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BUSINESS);
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.locator('#itinerary-title').scrollIntoViewIfNeeded();
  await noHorizontalOverflow(page);
  await cardTextDoesNotClipOrOverlap(page.locator('.itinerary-card'));
  await programmeDoesNotOverlap(page);
  await comfortableTargets(page.locator('.experience-nav button'));
  const nav = await page.locator('.experience-nav').boundingBox();
  const heading = await page.locator('#itinerary-title').boundingBox();
  expect(heading!.y).toBeGreaterThan(nav!.y + nav!.height);
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await noHorizontalOverflow(page);
  const headingText = await page.locator('#rsvp-title').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects()).map(({ left, right }) => ({ left, right }));
  });
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  for (const rect of headingText) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(viewportWidth);
  }
  await page.screenshot({ path: testInfo.outputPath('malay-200percent-rsvp.png') });
});

test('a failed journey chunk keeps wedding details and RSVP available', async ({ page }) => {
  await page.route('**/components/Journey.tsx*', route => route.abort());
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.locator('.ticket-scan-action').click();
  await expect(page.locator('.journey-recovery')).toContainText('Our journey could not load');
  await page.locator('.journey-recovery').getByRole('link', { name: 'Continue to wedding details', exact: true }).click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await page.getByLabel('Your name', { exact: true }).fill('Journey recovery guest');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Journey recovery guest');
});

test('data saver automatically keeps a readable flight without preference controls', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: Object.assign(new EventTarget(), { saveData: true, effectiveType: '2g' }),
    });
  });
  const flightRequests: string[] = [];
  page.on('request', request => { if (/\/flight\//.test(request.url())) flightRequests.push(request.url()); });
  await unlock(page);
  await expect(page.getByRole('button', { name: 'Simple view', exact: true })).toHaveCount(0);
  await openJourney(page);
  await expect(page.locator('.static-journey')).toBeVisible();
  await expect(page.locator('.static-journey img, canvas')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await openJourney(page);
  await expect(page.locator('.static-journey')).toBeVisible();
  expect(flightRequests).toEqual([]);
});

test('320px boarding and returning itinerary remain readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', 'One 320px layout check is sufficient.');
  await page.setViewportSize({ width: 320, height: 640 });
  await unlock(page, testCodes.BUSINESS);
  await noHorizontalOverflow(page);
  await comfortableTargets(page.locator('.boarding-page button'));
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('.itinerary-section')).toContainText('10:00');
  await expect(page.locator('.itinerary-section')).toContainText('10:45');
  await expect(page.locator('.itinerary-section')).toContainText('Crowne Plaza at Changi Airport');
  await noHorizontalOverflow(page);
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeInViewport();
  await noHorizontalOverflow(page);
});

test('blocked browser storage preserves an unfinished RSVP while revisiting the boarding pass', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  });
  await unlock(page);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await page.getByLabel('Your name', { exact: true }).fill('Storage unavailable guest');
  await showBoarding(page);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Storage unavailable guest');
  await page.reload();
  await expect(page.locator('#check-in-title')).toBeVisible();
});

test('a received RSVP and name survive boarding navigation when browser storage is blocked', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', 'One blocked-storage navigation check is sufficient.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  });
  const submissions = await mockRsvpBridge(page);
  await unlock(page);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await fillRsvp(page, ['attending']);
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  await expect(page.locator('.rsvp-confirmation')).toContainText('could not save the confirmation for your next visit');
  await showBoarding(page);
  await expect(page.locator('.ticket-paper-passenger').first()).toContainText('Mobile Test Guest');
  await openJourney(page);
  await expect(page.locator('.personal-salutation')).toContainText('Mobile Test Guest');
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  await expect(page.locator('.rsvp-form')).toHaveCount(0);
  await expect(page.locator('.rsvp-confirmation')).toContainText('could not save the confirmation for your next visit');
  expect(submissions).toHaveLength(1);
});

test('blocked storage retains the exact uncertain payload and identity across boarding navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', 'One uncertain retry check is sufficient.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  });
  const retries = await mockRsvpBridge(page, true);
  let firstPayload: SubmittedPayload | undefined;
  await page.route(testEndpoint, async route => {
    if (firstPayload) { await route.fallback(); return; }
    const form = new URLSearchParams(route.request().postData() ?? '');
    firstPayload = JSON.parse(form.get('payload') ?? '{}') as SubmittedPayload;
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Receipt unavailable</body></html>' });
  });
  await unlock(page);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await fillRsvp(page, ['attending']);
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect.poll(() => firstPayload).toBeDefined();
  await showBoarding(page);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await expect(page.getByLabel('Your name', { exact: true })).toBeDisabled();
  await expect(page.locator('.rsvp-section')).toContainText('could not confirm whether your RSVP reached us');
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  expect(retries).toEqual([firstPayload]);
});
