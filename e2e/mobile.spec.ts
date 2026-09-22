import { test, expect } from '@playwright/test';
import {
  cardTextDoesNotClipOrOverlap, comfortableTargets, fastTrack, fillRsvp, fitsPhone, mockRsvpBridge,
  journeyCueFitsFirstScreen, noHorizontalOverflow, programmeDoesNotOverlap,
  returnToInvitation, snapshot, ticketInstructionPrecedesTickets, unlock,
} from './helpers';
import { testCodes } from './test-config';

test('first bride unlock preserves boarding scan and cinematic content order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#check-in-title')).toBeVisible();
  await noHorizontalOverflow(page);
  await comfortableTargets(page.locator('.gate-page button'));
  await snapshot(page.locator('.gate-page'), 'check-in.png');
  await unlock(page);
  await expect(page.locator('.boarding-pass')).toHaveCount(1);
  await expect(page.locator('.boarding-pass')).toContainText('AN2108');
  await ticketInstructionPrecedesTickets(page);
  await fitsPhone(page.locator('.boarding-pass'), page);
  await cardTextDoesNotClipOrOverlap(page.locator('.boarding-pass'));
  await noHorizontalOverflow(page);
  await snapshot(page.locator('.boarding-page'), 'first-boarding.png');
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page);
  await snapshot(page.locator('.journey-stage'), 'journey-opening.png');
  await page.evaluate(() => window.scrollTo({ top: 48, behavior: 'instant' }));
  await expect(page.locator('.journey-scroll-cue')).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('.journey-scroll-cue')).toHaveCSS('opacity', '1');
  await expect(page.locator('.journey video')).toHaveCount(1);
  await expect(page.locator('.journey video source')).toHaveAttribute('src', /clouds-ping-pong\.mp4$/);
  await noHorizontalOverflow(page);
  await page.locator('.journey').evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + element.clientHeight * 0.5, behavior: 'instant' });
  });
  await expect.poll(() => page.locator('.journey').evaluate((element) => Number(element.style.getPropertyValue('--cloud-opacity')))).toBeGreaterThan(0);
  const order = await page.locator('main.experience > section, main.experience > details, main.experience > footer').evaluateAll(
    (elements) => elements.map((element) => element.id || element.classList[0]),
  );
  expect(order).toEqual([
    'journey', 'invitation', 'our-story-section',
    'itinerary-section', 'travel-section', 'rsvp', 'site-footer',
  ]);
  await page.locator('#invitation').scrollIntoViewIfNeeded();
  await expect(page.locator('#invitation h1')).toContainText('Aleem');
  await page.locator('.itinerary-section').scrollIntoViewIfNeeded();
  await expect(page.locator('.itinerary-card')).toHaveCount(1);
  await expect(page.locator('#flight-dashboard')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to boarding pass', exact: true }).click();
  await ticketInstructionPrecedesTickets(page);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page);
});

test('reopened groom invitation restores two tickets and fast tracks without journey requests', async ({ page, context }) => {
  const journeyRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/journey\//.test(request.url())) journeyRequests.push(request.url());
  });
  await returnToInvitation(page, testCodes.BUSINESS);
  await expect(page.getByLabel('Invitation code', { exact: true })).toHaveCount(0);
  await expect(page.locator('.boarding-pass')).toHaveCount(2);
  await ticketInstructionPrecedesTickets(page);
  await fitsPhone(page.locator('.boarding-pass'), page);
  await comfortableTargets(page.locator('.boarding-page button'));
  await snapshot(page.locator('.boarding-page'), 'returning-boarding.png');
  const storage = await context.storageState();
  const persisted = JSON.parse(storage.origins[0].localStorage.find((item) => item.name === 'our-flight:access')!.value);
  expect(persisted.version).toBe(4);
  expect(persisted).not.toHaveProperty('expiresAt');
  await page.getByRole('button', { name: 'Fast Track to Your Itinerary', exact: true }).click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('#itinerary-title')).toBeInViewport();
  await expect(page.locator('.journey, .static-journey, video')).toHaveCount(0);
  await expect(page.locator('.itinerary-card')).toHaveCount(2);
  await expect(page.locator('.itinerary-section')).toContainText('AN2108');
  await expect(page.locator('.itinerary-section')).toContainText('AN2208');
  await fitsPhone(page.locator('.itinerary-card'), page);
  await cardTextDoesNotClipOrOverlap(page.locator('.itinerary-card'));
  await comfortableTargets(page.locator('.itinerary-section .button'));
  await noHorizontalOverflow(page);
  await snapshot(page.locator('.itinerary-section'), 'two-event-itinerary.png');
  await programmeDoesNotOverlap(page);
  await page.locator('.travel-section summary').click();
  await expect(page.locator('.travel-details')).toContainText('MRT');
  expect(journeyRequests).toEqual([]);
  const itineraryUrl = page.url();
  await page.locator('.itinerary-rsvp').click();
  await expect(page).toHaveURL(/#rsvp$/);
  await page.goBack();
  await expect(page).toHaveURL(itineraryUrl);
  await expect(page.locator('.itinerary-section')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#rsvp$/);
  await expect(page.locator('#rsvp')).toBeVisible();
  await page.getByRole('button', { name: 'Back to boarding pass', exact: true }).click();
  await expect(page.locator('.boarding-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fast Track/i })).toBeVisible();
  await page.goForward();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('.journey, .static-journey, video')).toHaveCount(0);
  expect(journeyRequests).toEqual([]);
  await page.goBack();
  await expect(page.locator('.boarding-page')).toBeVisible();
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page);
});

test('switching invitation preserves drafts and new manual unlock has no fast track', async ({ page }) => {
  await fastTrack(page);
  await page.locator('#invitee-name').fill('Saved Draft Guest');
  await page.getByRole('button', { name: 'Use a different invitation', exact: true }).click();
  await expect(page.locator('#check-in-title')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('our-flight:access'))).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('our-flight:rsvp:')))).toBe(true);
  await page.getByLabel('Invitation code', { exact: true }).fill(testCodes.ECONOMY);
  await page.getByRole('button', { name: 'View invitation', exact: true }).click();
  await expect(page.locator('.boarding-pass')).toContainText('AN2208');
  await expect(page.locator('.boarding-pass')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Fast Track/i })).toHaveCount(0);
});

test('reduced-motion scan uses static cabin and clouds with no MP4 request', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mp4Requests: string[] = [];
  page.on('request', (request) => { if (/\.mp4(?:\?|$)/.test(request.url())) mp4Requests.push(request.url()); });
  await unlock(page);
  await ticketInstructionPrecedesTickets(page);
  const animatedTicketElements = await page.locator('.ticket-stack, .boarding-pass, .ticket-scan-instruction').evaluateAll((elements) => elements
    .filter((element) => getComputedStyle(element).animationName !== 'none').map((element) => element.className));
  expect(animatedTicketElements).toEqual([]);
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.static-journey')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.static-journey img[src*="clouds-video-poster"]')).toBeVisible();
  await journeyCueFitsFirstScreen(page);
  await expect(page.locator('.journey-scroll-cue')).toHaveCSS('animation-name', 'none');
  const staticCuePosition = await page.locator('.journey-scroll-cue').evaluate((element) => getComputedStyle(element).position);
  expect(['static', 'relative']).toContain(staticCuePosition);
  await snapshot(page.locator('.static-journey'), 'reduced-motion-journey.png');
  await noHorizontalOverflow(page);
  expect(mp4Requests).toEqual([]);
});

for (const connection of [
  { saveData: true, effectiveType: '4g' },
  { saveData: false, effectiveType: '2g' },
  { saveData: false, effectiveType: 'slow-2g' },
]) {
  test(`low-data ${connection.saveData ? 'saveData' : connection.effectiveType} retains cinema without MP4`, async ({ page }) => {
    await page.addInitScript((value) => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: Object.assign(new EventTarget(), value),
      });
    }, connection);
    const mp4Requests: string[] = [];
    page.on('request', (request) => { if (/\.mp4(?:\?|$)/.test(request.url())) mp4Requests.push(request.url()); });
    await unlock(page);
    await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
    await expect(page.locator('.journey')).toBeVisible();
    await expect(page.locator('video, source[src$=".mp4"]')).toHaveCount(0);
    await expect(page.locator('.journey-clouds img')).toHaveAttribute('src', /clouds-video-poster/);
    await page.locator('.journey').evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + element.clientHeight * 0.7, behavior: 'instant' });
    });
    await expect.poll(() => page.locator('.journey').evaluate((element) => Number(element.style.getPropertyValue('--cloud-opacity')))).toBe(1);
    await noHorizontalOverflow(page);
    await page.locator('.itinerary-section').scrollIntoViewIfNeeded();
    await expect(page.locator('#itinerary-title')).toBeVisible();
    expect(mp4Requests).toEqual([]);
  });
}

for (const duplicate of [false, true]) {
  test(`RSVP ${duplicate ? 'duplicate receipt' : 'success'} confirms flight and provides calendar`, async ({ page }) => {
    const submissions = await mockRsvpBridge(page, duplicate);
    await fastTrack(page);
    await expect(page.locator('.attendance-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
    await expect(page.locator('.error-summary')).toBeFocused();
    expect(submissions).toHaveLength(0);
    await fillRsvp(page, ['attending']);
    await comfortableTargets(page.locator('.radio-option, .form-actions button, #party-size-0'));
    await noHorizontalOverflow(page);
    if (!duplicate) await snapshot(page.locator('#rsvp'), 'rsvp-form.png');
    await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
    await expect(page.locator('.rsvp-confirmation--attending')).toBeVisible();
    await expect(page.locator('#rsvp h2')).toBeFocused();
    await expect(page.locator('#rsvp')).toContainText('Mobile Test Guest');
    await expect(page.locator('#rsvp')).toContainText('AN2108');
    await expect(page.locator('#rsvp')).toContainText('21 August 2027');
    await expect(page.locator('#rsvp')).toContainText('10:00');
    await expect(page.locator('#rsvp')).toContainText('Crowne Plaza');
    await expect(page.locator('#rsvp')).toContainText('Chengal');
    await expect(page.locator('.rsvp-confirmation__party')).toContainText('2');
    await expect(page.locator('.rsvp-form')).toHaveCount(0);
    await expect(page.locator('#rsvp [role="status"]')).toBeVisible();
    await noHorizontalOverflow(page);
    await fitsPhone(page.locator('.rsvp-confirmation__event'), page);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ credential: { kind: 'class-code', value: testCodes.BRIDE_BUSINESS }, responses: [{ eventId: 'day21', attendance: 'attending', partySize: 2 }] });
    if (duplicate) await expect(page.locator('#rsvp')).toContainText('No duplicate response was created');
    else await snapshot(page.locator('#rsvp'), 'rsvp-confirmed.png');
    const calendarLink = page.locator('#rsvp').getByRole('link', { name: 'Add to calendar', exact: true });
    await expect(calendarLink).toHaveAttribute('href', '/calendar/aleem-nurulain-day21-full-en.ics');
    await expect(calendarLink).not.toHaveAttribute('download');
    const download = page.waitForEvent('download');
    await calendarLink.click();
    const calendarDownload = await download;
    expect(calendarDownload.suggestedFilename()).toBe('aleem-nurulain-day21-full-en.ics');
    expect(await calendarDownload.failure()).toBeNull();
  });
}

test('declining has a warm confirmation and no calendar action', async ({ page }) => {
  const submissions = await mockRsvpBridge(page);
  await fastTrack(page, testCodes.BRIDE_ECONOMY);
  await fillRsvp(page, ['not-attending']);
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation--declining')).toBeVisible();
  await expect(page.locator('#rsvp h2')).toContainText(/miss having you on board/i);
  await expect(page.locator('#rsvp [role="alert"]')).toHaveCount(0);
  await expect(page.locator('#rsvp').getByRole('link', { name: /calendar/i })).toHaveCount(0);
  expect(submissions[0].responses).toEqual([{ eventId: 'day21', attendance: 'not-attending' }]);
  await noHorizontalOverflow(page);
});

test('mixed groom attendance shows each day and calendar only for attending day', async ({ page }) => {
  await mockRsvpBridge(page);
  await fastTrack(page, testCodes.BUSINESS);
  await fillRsvp(page, ['attending', 'not-attending']);
  await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
  await expect(page.locator('.rsvp-confirmation--mixed')).toBeVisible();
  await expect(page.locator('#rsvp h2')).toContainText(/itinerary is confirmed/i);
  const events = page.locator('.rsvp-confirmation__event');
  await expect(events).toHaveCount(2);
  await expect(events.nth(0)).toContainText('AN2108');
  await expect(events.nth(1)).toContainText('AN2208');
  await expect(events.nth(0).getByRole('link', { name: /calendar/i })).toHaveCount(1);
  await expect(events.nth(1).getByRole('link', { name: /calendar/i })).toHaveCount(0);
  await expect(events.nth(1)).toContainText('Unable to attend');
  await noHorizontalOverflow(page);
  await snapshot(page.locator('#rsvp'), 'rsvp-mixed.png');
});

test('Malay with 125 percent text fits tickets, details, itinerary and RSVP', async ({ page }, testInfo) => {
  await returnToInvitation(page, testCodes.BRIDE_FIRST);
  await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await expect(page.getByRole('button', { name: 'English (EN)', exact: true })).toBeVisible();
  await fitsPhone(page.locator('.boarding-pass'), page);
  await cardTextDoesNotClipOrOverlap(page.locator('.boarding-pass'));
  await noHorizontalOverflow(page);
  await comfortableTargets(page.locator('.boarding-page button'));
  await page.locator('.boarding-page').screenshot({ path: testInfo.outputPath('malay-scaled-boarding.png') });
  await ticketInstructionPrecedesTickets(page, 'Ketik tiket untuk imbas dan naik pesawat');
  await page.getByRole('button', { name: 'Laluan Pantas ke Jadual Majlis Anda', exact: true }).click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await fitsPhone(page.locator('.itinerary-card, .attendance-card'), page);
  await cardTextDoesNotClipOrOverlap(page.locator('.itinerary-card'));
  await programmeDoesNotOverlap(page);
  await noHorizontalOverflow(page);
  await page.locator('.itinerary-section').screenshot({ path: testInfo.outputPath('malay-scaled-itinerary.png') });
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  const nav = page.locator('.experience-nav');
  const navBox = await nav.boundingBox();
  expect(navBox!.x).toBeGreaterThanOrEqual(0);
  expect(navBox!.y).toBeGreaterThanOrEqual(0);
  await comfortableTargets(nav.locator('button'));
  await page.locator('#attendance-0-yes').check();
  await page.locator('#party-size-0').fill('3');
  await comfortableTargets(page.locator('.radio-option, #party-size-0, .form-actions button'));
  await page.getByRole('button', { name: 'English (EN)', exact: true }).click();
  await expect(page.locator('#rsvp h2')).toHaveText('Confirm your attendance');
});

test('all calendar scopes and languages have real HTTP calendar responses', async ({ request }) => {
  for (const locale of ['en', 'ms']) {
    for (const key of ['day21-reception', 'day21-full', 'day22']) {
      const response = await request.get(`/calendar/aleem-nurulain-${key}-${locale}.ics`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/calendar');
      const contents = await response.text();
      expect(contents).toContain('BEGIN:VCALENDAR\r\n');
      expect(contents.match(/BEGIN:VEVENT/g)).toHaveLength(key === 'day21-full' ? 2 : 1);
      expect(contents).toContain('TZID:Asia/Singapore');
      expect(contents).toContain('Chengal Ballroom');
      if (key === 'day21-reception') {
        expect(contents).not.toMatch(/Nikah/i);
        expect(contents).toContain('DTSTART;TZID=Asia/Singapore:20270821T120000');
        expect(contents).toContain('UID:an2108-2@aleem-nurulain');
      }
      if (key === 'day22') {
        expect(contents).toContain(locale === 'en' ? "Groom's Reception" : 'Walimatul Urus');
        expect(contents).toContain('DTSTART;TZID=Asia/Singapore:20270822T120000');
      }
    }
  }
});

test('two-ticket Malay journey has visible guidance and supports keyboard boarding', async ({ page }, testInfo) => {
  await unlock(page, testCodes.BRIDE_FIRST);
  await page.getByRole('button', { name: 'Bahasa Melayu (BM)', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await ticketInstructionPrecedesTickets(page, 'Ketik tiket untuk imbas dan naik pesawat');
  const scan = page.getByRole('button', { name: 'Ketik tiket untuk imbas dan naik pesawat', exact: true });
  await scan.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ticket-scan-action')).toBeDisabled();
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page, 'Tatal ke bawah untuk memulakan perjalanan anda');
  await noHorizontalOverflow(page);
  await page.locator('.journey-stage').screenshot({ path: testInfo.outputPath('malay-scaled-journey.png') });
  await page.getByRole('button', { name: 'Kembali ke pas masuk', exact: true }).click();
  await scan.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page, 'Tatal ke bawah untuk memulakan perjalanan anda');
});

test('desktop tickets and scroll prompt remain clear', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-standard', 'One desktop viewport check is sufficient.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await unlock(page, testCodes.BUSINESS);
  await ticketInstructionPrecedesTickets(page);
  await fitsPhone(page.locator('.boarding-pass'), page);
  await noHorizontalOverflow(page);
  await page.locator('.boarding-page').screenshot({ path: testInfo.outputPath('desktop-boarding.png') });
  await page.getByRole('button', { name: 'Tap ticket to scan and board', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await journeyCueFitsFirstScreen(page);
  await page.locator('.journey-stage').screenshot({ path: testInfo.outputPath('desktop-journey.png') });
});
