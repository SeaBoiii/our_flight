import { expect, type Locator, type Page } from '@playwright/test';
import { testCodes, testEndpoint } from './test-config';

export async function unlock(page: Page, code: string = testCodes.BRIDE_BUSINESS) {
  await page.goto('/');
  await page.getByLabel('Invitation code', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'View invitation', exact: true }).click();
  await expect(page.locator('#boarding-title')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fast Track/i })).toHaveCount(0);
}

export async function returnToInvitation(page: Page, code: string = testCodes.BRIDE_BUSINESS) {
  await unlock(page, code);
  await page.reload();
  await expect(page.getByRole('button', { name: /Fast Track/i })).toBeVisible();
}

export async function fastTrack(page: Page, code: string = testCodes.BRIDE_BUSINESS) {
  await returnToInvitation(page, code);
  await page.getByRole('button', { name: /Fast Track/i }).click();
  await expect(page.locator('#itinerary-title')).toBeFocused();
}

export async function ticketInstructionPrecedesTickets(page: Page, label = 'Tap ticket to scan and board') {
  const instruction = page.locator('.ticket-scan-instruction');
  await expect(instruction).toHaveText(label);
  const instructionBox = await instruction.boundingBox();
  const ticketBox = await page.locator('.boarding-pass').first().boundingBox();
  expect(instructionBox).not.toBeNull();
  expect(ticketBox).not.toBeNull();
  expect(instructionBox!.y + instructionBox!.height, 'Scan guidance belongs above the tickets').toBeLessThanOrEqual(ticketBox!.y + 1);
}

export async function journeyCueFitsFirstScreen(page: Page, label = 'Scroll down to begin your journey') {
  const cue = page.locator('.journey-scroll-cue');
  await expect(cue).toHaveText(label);
  await expect(cue).toHaveCSS('opacity', '1');
  await expect(cue.locator('a, button')).toHaveCount(0);
  const cueBox = await cue.boundingBox();
  const navBox = await page.locator('.experience-nav').boundingBox();
  const headingBox = await page.locator('.journey h1, .static-journey h1').boundingBox();
  expect(cueBox).not.toBeNull();
  expect(cueBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height);
  expect(cueBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height);
  expect(cueBox!.y + cueBox!.height, 'Scroll guidance must fit in the first screen').toBeLessThanOrEqual(page.viewportSize()!.height);
  const ticket = page.locator('.journey-ticket');
  const ticketBox = await ticket.count() ? await ticket.boundingBox() : null;
  if (ticketBox) expect(cueBox!.y, 'Journey tickets must not cover scroll guidance').toBeGreaterThanOrEqual(ticketBox.y + ticketBox.height - 1);
  await fitsPhone(cue, page);
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
  ) - window.innerWidth);
  expect(overflow, 'The document must fit the phone viewport').toBeLessThanOrEqual(1);
}

export async function fitsPhone(locator: Locator, page: Page) {
  const boxes = await locator.evaluateAll((elements) => elements.map((element) => {
    const { left, right } = element.getBoundingClientRect();
    return { left, right };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}

export async function comfortableTargets(locator: Locator) {
  const boxes = await locator.evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length)
    .map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { label: element.textContent?.trim(), width, height };
    }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width, `Touch width: ${box.label}`).toBeGreaterThanOrEqual(44);
    expect(box.height, `Touch height: ${box.label}`).toBeGreaterThanOrEqual(44);
  }
}

export async function programmeDoesNotOverlap(page: Page) {
  const overlaps = await page.locator('.event-programme li').evaluateAll((rows) => rows
    .filter((row) => {
      const [time, title] = Array.from(row.children).map((child) => child.getBoundingClientRect());
      return time && title && time.right > title.left + 1 && time.bottom > title.top + 1;
    }).map((row) => row.textContent));
  expect(overlaps, 'Itinerary time and programme title must not collide').toEqual([]);
}

export async function cardTextDoesNotClipOrOverlap(cards: Locator) {
  const issues = await cards.evaluateAll((elements) => elements.flatMap((card) => {
    const bounds = card.getBoundingClientRect();
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const text: { label: string; rect: DOMRect; parent: HTMLElement; layout: DOMRect }[] = [];
    const problems: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || !parent.getClientRects().length
        || parent.closest('.visually-hidden, .boarding-stamp')) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const label = node.textContent.trim();
        if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1
          || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
          problems.push(`Clipped card text: ${label}`);
        }
        text.push({ label, rect, parent, layout: parent.getBoundingClientRect() });
      }
    }
    for (let index = 0; index < text.length; index += 1) {
      const left = text[index];
      for (const right of text.slice(index + 1)) {
        // A font's ascender/descender bounds can extend beyond its line box.
        // Require distinct, colliding layout boxes before flagging text overlap.
        if (left.parent === right.parent) continue;
        const layoutWidth = Math.min(left.layout.right, right.layout.right) - Math.max(left.layout.left, right.layout.left);
        const layoutHeight = Math.min(left.layout.bottom, right.layout.bottom) - Math.max(left.layout.top, right.layout.top);
        const width = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
        const height = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
        if (layoutWidth > 2 && layoutHeight > 2 && width > 2 && height > 2) {
          problems.push(`Overlapping text: ${left.label} / ${right.label}`);
        }
      }
    }
    return problems;
  }));
  expect(issues, 'Important text must remain inside each card without collisions').toEqual([]);
}

export type SubmittedPayload = {
  version: number;
  credential: { kind: string; value: string };
  responseId: string;
  locale: string;
  inviteeName: string;
  message?: string;
  responses: { eventId: string; attendance: string; partySize?: number }[];
};

export async function mockRsvpBridge(page: Page, duplicate = false) {
  const submissions: SubmittedPayload[] = [];
  // Exercise the real form POST and origin/nonce/response-ID receipt validation.
  // The endpoint is fake and fulfilled locally; no wedding backend is contacted.
  await page.route(testEndpoint, async (route) => {
    expect(route.request().method()).toBe('POST');
    const form = new URLSearchParams(route.request().postData() ?? '');
    const payload = JSON.parse(form.get('payload') ?? '{}') as SubmittedPayload;
    expect(form.get('bridgeVersion')).toBe('2');
    expect(payload.version).toBe(2);
    expect(form.get('nonce')).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload.responseId).toMatch(/^[a-f0-9-]{36}$/);
    submissions.push(payload);
    const receipt = JSON.stringify({
      type: 'our-flight:rsvp-result', version: 2, nonce: form.get('nonce'),
      responseId: payload.responseId, ok: true, duplicate,
    }).replaceAll('<', '\\u003c');
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><script>parent.postMessage(${receipt}, 'http://127.0.0.1:4173');</script></body></html>`,
    });
  });
  return submissions;
}

export async function fillRsvp(page: Page, answers: ('attending' | 'not-attending')[]) {
  await page.locator('#invitee-name').fill('Mobile Test Guest');
  for (const [index, attendance] of answers.entries()) {
    await page.locator(`#attendance-${index}-${attendance === 'attending' ? 'yes' : 'no'}`).check();
    if (attendance === 'attending') await page.locator(`#party-size-${index}`).fill('2');
  }
}

export async function snapshot(locator: Locator, name: string) {
  await locator.page().evaluate(() => document.fonts.ready);
  await expect(locator).toHaveScreenshot(name);
}
