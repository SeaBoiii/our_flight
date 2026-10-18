import { expect, test } from '@playwright/test';
import { unlock, openJourney, showBoarding, noHorizontalOverflow, comfortableTargets, mockRsvpBridge, fillRsvp, cardTextDoesNotClipOrOverlap } from './helpers';
import { testCodes } from './test-config';
import AxeBuilder from '@axe-core/playwright';

test('airport check-in adapts from small phones through desktop', async ({ page }, testInfo) => {
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 1000]]) {
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
  await openJourney(page);
  const journey = page.locator('.journey');
  await expect(journey).toBeVisible();
  await expect(page.locator('.journey-cabin img')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  for (const [phase, progress] of [['opening', 0], ['takeoff', .30], ['cabin', .51], ['window', .68], ['arrival', .96]] as const) {
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
      // From .86 the golden-hour sky fully covers the clouds, which pause there.
      if (progress >= .56 && progress < .86 && await canvas.getAttribute('data-renderer') === 'webgl') {
        await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeCloseTo(progress, 2);
      }
    }
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`flight-${phase}.png`) });
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => journey.evaluate(el => Number(el.style.getPropertyValue('--intro-opacity')))).toBe(1);
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
  // ScrollTrigger records the reader's place when a resize starts and restores
  // it after its debounced refresh (200 ms, plus the 100 ms re-measure), so a
  // rotated phone keeps its position. Let that settle before navigating.
  await page.waitForTimeout(500);
  await expect.poll(async () => {
    await page.locator('#itinerary-title').scrollIntoViewIfNeeded();
    return page.locator('#itinerary-title').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
  }).toBe(true);
  await expect(page.locator('#itinerary-title')).toBeInViewport();
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  expect(errors).toEqual([]);
});

test('daylight invitation, itinerary and reply card adapt through desktop', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BUSINESS);
  await openJourney(page);
  await expect(page.locator('.static-journey')).toBeVisible();
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await noHorizontalOverflow(page);
    for (const section of ['.invitation-reveal', '.itinerary-section', '.travel-section', '.rsvp-section']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      await page.locator(section).screenshot({ path: testInfo.outputPath(`${section.slice(1)}-${width}.png`) });
    }
  }
});

test('all eight invitation profiles retain event eligibility and bilingual presentation', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [profile, code] of Object.entries(testCodes)) {
    // Clear storage from a same-origin static file, not the app: the app saves the
    // language as it mounts and could otherwise restore the previous profile's choice.
    await page.goto('/favicon.png');
    await page.evaluate(() => localStorage.clear());
    await unlock(page, code);
    await openJourney(page);
    const bothDays = ['BUSINESS', 'FIRST', 'BRIDE_FIRST'].includes(profile);
    const day21 = bothDays || profile.startsWith('BRIDE_');
    const nikah = bothDays || profile === 'BRIDE_BUSINESS';
    const itinerary = page.locator('.itinerary-section');
    await expect(itinerary.locator('.itinerary-card')).toHaveCount(bothDays ? 2 : 1);
    const expectedEnglish = bothDays ? ["Nikah & Bride's Reception", "Groom's Reception"] : [nikah ? 'Nikah & Wedding Reception' : 'Wedding Reception'];
    const expectedMalay = bothDays ? ['Nikah & Resepsi Pengantin Perempuan', 'Walimatul Urus'] : [nikah ? 'Nikah & Resepsi Perkahwinan' : 'Resepsi Perkahwinan'];
    await expect(itinerary.locator('.itinerary-event-heading h4')).toHaveText(expectedEnglish);
    if (nikah) await expect(itinerary).toContainText('Nikah');
    else await expect(itinerary).not.toContainText('Nikah');
    await expect(itinerary.locator('time').first()).toHaveAttribute('dateTime', day21 ? '2027-08-21' : '2027-08-22');
    await expect(itinerary.getByRole('link', { name: 'Add to calendar', exact: true })).toHaveCount(0);
    await expect(page.locator('.guest-overview, .experience-shortcuts, .wedding-timeline')).toHaveCount(0);
    await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
    await expect(itinerary.locator('.itinerary-event-heading h4')).toHaveText(expectedMalay);
    await cardTextDoesNotClipOrOverlap(itinerary.locator('.itinerary-card'));
  }
});

test('320px Malay tickets and static welcome survive 200 percent text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
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
  await expect(page.locator('.static-journey h1')).toHaveText('Selamat datang');
  await expect(page.locator('.static-journey')).toContainText('Aleem & Nurulain');
  await cardTextDoesNotClipOrOverlap(page.locator('.itinerary-card'));
  await page.locator('.static-journey').screenshot({ path: testInfo.outputPath('malay-static-200percent.png') });
});

test('failed decorative artwork leaves the invitation and RSVP usable', async ({ page }, testInfo) => {
  await page.route('**/flight/**', route => route.abort());
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await openJourney(page);
  await page.locator('#itinerary-title').scrollIntoViewIfNeeded();
  await expect(page.locator('.itinerary-section')).toContainText('Wedding Reception');
  await expect(page.locator('.itinerary-section')).not.toContainText('Nikah');
  await expect(page.locator('.travel-section address')).toContainText('75 Airport Boulevard');
  await page.locator('.itinerary-rsvp').click();
  await expect(page.locator('#rsvp-title')).toBeFocused();
  await page.getByLabel('Your name', { exact: true }).fill('Artwork failure guest');
  await expect(page.locator('.experience-shortcuts')).toHaveCount(0);
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

test('verified names persist only with their invitation and clear with device information', async ({ page }, testInfo) => {
  const submissions = await mockRsvpBridge(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await openJourney(page);
  await page.locator('.itinerary-rsvp').click();
  await fillRsvp(page, ['attending']);
  await page.locator('#invitee-name').fill('  Remembered Guest  ');
  await page.locator('#guest-message').fill('A private message that should not persist in the receipt.');
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('receipt.png') });
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back, Remembered Guest.');
  await expect(page.locator('.rsvp-confirmation')).toBeVisible();
  await expect(page.locator('.rsvp-form')).toHaveCount(0);
  const receipt = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('our-flight:receipt:')).map(key => JSON.parse(localStorage.getItem(key)!)));
  expect(receipt).toHaveLength(1);
  expect(receipt[0]).toMatchObject({ version: 2, guestName: 'Remembered Guest' });
  expect(JSON.stringify(receipt)).not.toContain('private message');
  await expect(page.locator('.rsvp-confirmation a[href$=".ics"]')).toHaveAttribute('href', '/calendar/aleem-nurulain-day21-reception-single-day-en.ics');
  await openJourney(page);
  await expect(page.locator('.personal-salutation')).toContainText('Remembered Guest');
  await showBoarding(page);
  await expect(page.locator('.ticket-paper-passenger').first()).toContainText('Remembered Guest');
  await page.locator('.boarding-fast-track').click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await page.getByRole('button', { name: 'Use a different invitation', exact: true }).click();
  await unlock(page, testCodes.ECONOMY);
  await expect(page.locator('.ticket-paper-passenger').first()).not.toContainText('Remembered Guest');
  await openJourney(page);
  await expect(page.locator('.personal-salutation')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back.');
  await page.locator('.device-settings summary').click();
  await page.getByRole('button', { name: 'Forget this device', exact: true }).click();
  await expect(page.locator('#check-in-title')).toBeVisible();
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.reload();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back.');
  await expect(page.locator('.rsvp-confirmation')).toHaveCount(0);
  expect(submissions).toHaveLength(1);
});

test('older receipts keep their confirmation without inventing a remembered name', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.evaluate(() => {
    const access = JSON.parse(localStorage.getItem('our-flight:access')!);
    localStorage.setItem(`our-flight:receipt:${access.fingerprint}`, JSON.stringify({
      version: 1, responseId: 'a50db40c-f19b-4c0b-9c32-d9e9b160282b', confirmedAt: '2026-09-26T22:00:00.000Z',
      guestName: 'Unexpected Legacy Name', responses: [{ eventId: 'day21', attendance: 'attending', partySize: '2' }],
    }));
  });
  await page.reload();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back.');
  await expect(page.locator('.rsvp-confirmation')).toContainText('RSVP received on this device');
  await expect(page.locator('.rsvp-form')).toHaveCount(0);
  await openJourney(page);
  await expect(page.locator('.personal-salutation')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Unexpected Legacy Name');
});

test('starting another guest reply removes the previous name from the current invitation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await unlock(page, testCodes.BRIDE_ECONOMY);
  await page.evaluate(() => {
    const access = JSON.parse(localStorage.getItem('our-flight:access')!);
    localStorage.setItem(`our-flight:receipt:${access.fingerprint}`, JSON.stringify({
      version: 2, responseId: 'a50db40c-f19b-4c0b-9c32-d9e9b160282b', confirmedAt: '2026-09-26T22:00:00.000Z',
      guestName: 'Earlier Guest', responses: [{ eventId: 'day21', attendance: 'attending', partySize: '2' }],
    }));
  });
  await page.reload();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back, Earlier Guest.');
  await page.getByRole('button', { name: 'Another guest using this device', exact: true }).click();
  await expect(page.locator('.rsvp-section')).toContainText('This does not change the earlier response.');
  await page.getByRole('button', { name: /Start another guest.s RSVP/ }).click();
  await expect(page.locator('.returning-greeting')).toHaveText('Welcome back.');
  await expect(page.locator('#invitee-name')).toHaveValue('');
  await expect(page.locator('.rsvp-confirmation')).toHaveCount(0);
  await showBoarding(page);
  await expect(page.locator('.ticket-paper-passenger').first()).not.toContainText('Earlier Guest');
  await openJourney(page);
  await expect(page.locator('.personal-salutation')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Earlier Guest');
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
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await scan('returning-itinerary');
});
