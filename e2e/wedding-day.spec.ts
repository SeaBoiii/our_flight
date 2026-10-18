import { expect, test, type Page } from '@playwright/test';
import { returnToInvitation } from './helpers';
import { testCodes } from './test-config';

const galleryUrl = 'https://gallery.example.test/';
const duringReception = '2027-08-22T13:00:00+08:00';

async function returnOnDate(page: Page, instant: string) {
  await returnToInvitation(page, testCodes.BUSINESS);
  // The shared unlock helper fixes an earlier date, so change it after that visit.
  await page.clock.setFixedTime(new Date(instant));
  await page.reload();
  await expect(page.locator('#itinerary-title')).toBeFocused();
}

async function unlockOnEventDay(page: Page) {
  // A first visit must start on the event day without the shared helper's clock reset.
  await page.clock.setFixedTime(new Date(duringReception));
  await page.goto('/');
  await page.getByLabel('Invitation code', { exact: true }).fill(testCodes.BUSINESS);
  await page.getByRole('button', { name: 'View invitation', exact: true }).click();
  await expect(page.locator('#boarding-title')).toBeVisible();
}

test('returning both-days guest sees the live programme, photos, today first and primary directions', async ({ page }) => {
  await returnOnDate(page, duringReception);

  const today = page.locator('.today-panel--during');
  await expect(today).toBeVisible();
  await expect(today.getByRole('heading')).toHaveText('We are celebrating now');
  await expect(today.locator('.today-programme li')).toHaveText([
    /Now\s*12:30\s*Kompang procession/,
    /Next\s*14:30\s*Couple march-in/,
  ]);
  const photos = today.getByRole('link', { name: /^Share your photos/ });
  await expect(photos).toHaveAttribute('href', galleryUrl);
  await expect(photos).toHaveAttribute('target', '_blank');
  await expect(photos).toHaveAttribute('rel', 'noreferrer');

  const cards = page.locator('.itinerary-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveClass(/itinerary-card--today/);
  await expect(cards.nth(0).locator('time')).toHaveAttribute('datetime', '2027-08-22');
  await expect(cards.nth(0).locator('.itinerary-status')).toHaveText('Today');
  await expect(cards.nth(0).locator('.itinerary-status')).toHaveCSS('text-transform', 'uppercase');
  await expect(cards.nth(1)).toHaveClass(/itinerary-card--landed/);
  await expect(cards.nth(1).locator('time')).toHaveAttribute('datetime', '2027-08-21');
  await expect(cards.nth(1).locator('.itinerary-status')).toHaveText('Landed');

  await cards.first().evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const dock = page.getByRole('navigation', { name: 'Quick actions', exact: true });
  await expect(dock).toHaveClass(/boarding-dock--visible/);
  await expect(dock).toBeInViewport();
  await expect(dock.locator('.dock-item')).toHaveText(['Itinerary', 'Photos', 'Directions']);
  await expect(dock.getByRole('link', { name: /^Photos/ })).toHaveAttribute('href', galleryUrl);
  const directions = dock.getByRole('button', { name: 'Directions', exact: true });
  await expect(dock.locator('.dock-item').last()).toHaveClass(/dock-item--primary/);
  await expect(dock.locator('.dock-item--primary')).toHaveText('Directions');
  await directions.click();

  const sheet = page.getByRole('dialog', { name: 'Getting to the venue', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: /^Google Maps/ })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\//);
  await expect(sheet.getByRole('link', { name: /^Waze/ })).toHaveAttribute('href', /^https:\/\/waze\.com\/ul\?/);
});

test('the day after the wedding shows LANDED and the photo thank-you card', async ({ page }) => {
  await returnOnDate(page, '2027-08-23T09:30:00+08:00');

  const board = page.locator('.departure-board--landed');
  await expect(board).toBeVisible();
  await expect(board.locator('.departure-status .split-flap')).toHaveText('LANDED');
  await expect(board).toContainText('All flights have landed. Thank you for flying with us.');
  const thanks = page.locator('.today-panel--landed');
  await expect(thanks).toBeVisible();
  await expect(thanks.getByRole('heading')).toHaveText('Thank you for flying with us');
  await expect(thanks.getByRole('link', { name: /^Share your photos/ })).toHaveAttribute('href', galleryUrl);
  await expect(thanks.getByRole('link', { name: /Google Maps|Waze/ })).toHaveCount(0);
  await expect(page.locator('.itinerary-card--landed')).toHaveCount(2);
});

test('first visit on an event day can skip straight from boarding to the itinerary', async ({ page }) => {
  await unlockOnEventDay(page);

  const skip = page.getByRole('button', { name: 'Skip to today’s details', exact: true });
  await expect(skip).toHaveClass(/boarding-skip-today/);
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.locator('.experience--fast-track')).toBeVisible();
  await expect(page.locator('#itinerary-title')).toBeFocused();
  await expect(page.locator('#itinerary-title')).toBeInViewport();
  await expect(page.locator('.today-panel--during')).toBeVisible();
  await expect(page.locator('.journey, .static-journey')).toHaveCount(0);
});
