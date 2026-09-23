import { expect, test } from '@playwright/test';
import { unlock, noHorizontalOverflow, comfortableTargets, mockRsvpBridge, fillRsvp, cardTextDoesNotClipOrOverlap } from './helpers';
import { testCodes } from './test-config';
import AxeBuilder from '@axe-core/playwright';

test('airport check-in adapts from small phones through desktop', async ({ page }, testInfo) => {
  for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('button', { name: 'View invitation', exact: true })).toBeInViewport();
    await noHorizontalOverflow(page);
    await comfortableTargets(page.locator('.gate-page button'));
    await expect(page.locator('.gate-background img')).toHaveJSProperty('complete', true);
    await page.screenshot({ path: testInfo.outputPath(`gate-${width}.png`) });
  }
});

test('cinematic phases load progressively, reverse and resize without losing navigation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page, testCodes.BUSINESS);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await expect(page.locator('.journey-cabin img')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  for (const [phase, progress] of [['ticket', 0], ['takeoff', .30], ['cabin', .51], ['window', .68], ['arrival', .96]] as const) {
    await journey.evaluate((element, value) => {
      const stage = element.querySelector('.journey-stage') as HTMLElement;
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + (element.clientHeight - stage.clientHeight) * value, behavior: 'instant' });
    }, progress);
    await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--journey-progress')))).toBeCloseTo(progress, 2);
    await expect.poll(() => journey.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
    await journey.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
    if (progress >= .51) {
      await expect(page.locator('.journey-cabin img')).toHaveJSProperty('complete', true);
      await expect(page.locator('.journey-cabin img')).not.toHaveJSProperty('naturalWidth', 0);
      const canvas = journey.locator('canvas');
      await expect(canvas).toHaveAttribute('data-renderer', /webgl|fallback/);
      if (progress >= .56 && await canvas.getAttribute('data-renderer') === 'webgl') {
        await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeCloseTo(progress, 2);
      }
    }
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`flight-${phase}.png`) });
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--ticket-opacity')))).toBe(1);
  await expect(page.locator('.journey-scroll-cue')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await journey.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('flight-landscape.png') });
  await journey.evaluate(element => {
    const stage = element.querySelector('.journey-stage') as HTMLElement;
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + (element.clientHeight - stage.clientHeight) * .68, behavior: 'instant' });
  });
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--journey-progress')))).toBeCloseTo(.68, 2);
  await journey.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  await page.screenshot({ path: testInfo.outputPath('flight-landscape-window.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#itinerary-title').scrollIntoViewIfNeeded();
  await expect(page.locator('#itinerary-title')).toBeInViewport();
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  expect(errors).toEqual([]);
});

test('daylight invitation, itinerary and reply card adapt through desktop', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BUSINESS);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await noHorizontalOverflow(page);
    for (const section of ['.invitation-reveal', '.itinerary-section', '.travel-section', '.rsvp-section']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      await page.locator(section).screenshot({ path: testInfo.outputPath(`${section.slice(1)}-${width}.png`) });
    }
  }
});

test('all eight invitation profiles retain their event eligibility', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [profile, code] of Object.entries(testCodes)) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await unlock(page, code);
    const bothDays = ['BUSINESS', 'FIRST', 'BRIDE_FIRST'].includes(profile);
    const day21 = bothDays || profile.startsWith('BRIDE_');
    const nikah = bothDays || profile === 'BRIDE_BUSINESS';
    await expect(page.locator('.boarding-pass')).toHaveCount(bothDays ? 2 : 1);
    await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
    const itinerary = page.locator('.itinerary-section');
    await expect(itinerary.locator('.itinerary-card')).toHaveCount(bothDays ? 2 : 1);
    if (day21) await expect(itinerary).toContainText("Bride's Reception");
    else await expect(itinerary).not.toContainText("Bride's Reception");
    if (nikah) await expect(itinerary).toContainText('Nikah');
    else await expect(itinerary).not.toContainText('Nikah');
    if (bothDays || !day21) await expect(itinerary).toContainText("Groom's Reception");
    else await expect(itinerary).not.toContainText("Groom's Reception");
    await expect(itinerary.getByRole('link', { name: 'Add to calendar', exact: true })).toHaveCount(bothDays ? 2 : 1);
  }
});

test('360px Malay check-in, tickets and static welcome survive 200 percent text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await noHorizontalOverflow(page);
  await page.locator('#invitation-code').fill(testCodes.BRIDE_FIRST);
  await page.locator('.gate-copy .button').click();
  await expect(page.locator('#boarding-title')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Ketik tiket untuk imbas dan naik pesawat', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  await noHorizontalOverflow(page);
  await cardTextDoesNotClipOrOverlap(page.locator('.static-ticket .ceremonial-ticket'));
  await page.locator('.static-journey').screenshot({ path: testInfo.outputPath('malay-static-200percent.png') });
});

test('failed decorative artwork leaves the invitation and RSVP usable', async ({ page }, testInfo) => {
  await page.route('**/flight/**', route => route.abort());
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await page.locator('#itinerary-title').scrollIntoViewIfNeeded();
  await expect(page.locator('.itinerary-section')).toContainText("Bride's Reception");
  await expect(page.locator('.itinerary-section')).not.toContainText('Nikah');
  await expect(page.locator('.travel-section address')).toContainText('75 Airport Boulevard');
  await page.locator('.itinerary-rsvp').click();
  await page.getByLabel('Your name', { exact: true }).fill('Artwork failure guest');
  await expect(page.locator('.experience')).toHaveAttribute('data-editing', '');
  await expect(page.locator('.experience-shortcuts')).toBeHidden();
  // Emulate the reduced viewport available while a software keyboard is open.
  await page.setViewportSize({ width: 390, height: 400 });
  await page.locator('#invitee-name').scrollIntoViewIfNeeded();
  await expect(page.locator('#invitee-name')).toBeInViewport();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('keyboard-viewport.png') });
  await page.locator('#invitee-name').blur();
  await expect(page.locator('.experience-shortcuts')).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('WebKit and Chromium preserve RSVP receipt confirmation', async ({ page }, testInfo) => {
  await mockRsvpBridge(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  await page.locator('.itinerary-rsvp').click();
  await fillRsvp(page, ['attending']);
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('receipt.png') });
});

test('check-in, boarding and the full invitation pass automated accessibility checks', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const scan = async (state: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await testInfo.attach(`accessibility-${state}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.violations.map(violation => ({ rule: violation.id, elements: violation.nodes.map(node => node.target) }))).toEqual([]);
  };
  await scan('gate');
  await unlock(page, testCodes.BUSINESS);
  await scan('boarding');
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  await scan('invitation');
});
