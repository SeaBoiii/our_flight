import { expect, test } from '@playwright/test';
import { openJourney, unlock } from './helpers';
import { testCodes } from './test-config';

for (const invitation of [
  {
    side: 'bride',
    code: testCodes.BRIDE_ECONOMY,
    name: 'Wahab family (test)',
    otherName: 'Jamal family (test)',
    phone: '6590000001',
  },
  {
    side: 'groom',
    code: testCodes.ECONOMY,
    name: 'Jamal family (test)',
    otherName: 'Wahab family (test)',
    phone: '6580000002',
  },
]) {
  test(`${invitation.side} single-day invitation shows only its hosting family's contact at the venue`, async ({ page }) => {
    await unlock(page, invitation.code);
    await openJourney(page);

    const venue = page.getByRole('region', { name: 'Getting here', exact: true });
    await venue.scrollIntoViewIfNeeded();
    const contacts = venue.getByRole('region', { name: 'Questions? Message the family', exact: true });
    await expect(contacts).toBeVisible();
    await expect(contacts.getByRole('listitem')).toHaveCount(1);
    await expect(contacts).toContainText(invitation.name);
    await expect(venue.getByText(invitation.otherName, { exact: true })).toHaveCount(0);

    const message = contacts.getByRole('link', { name: `Message ${invitation.name} on WhatsApp`, exact: true });
    await expect(message).toBeVisible();
    await expect(message).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${invitation.phone}\\?text=.+$`));
    const url = new URL((await message.getAttribute('href'))!);
    expect(`${url.origin}${url.pathname}`).toBe(`https://wa.me/${invitation.phone}`);
    expect(url.searchParams.get('text')?.trim()).toBeTruthy();
  });
}
