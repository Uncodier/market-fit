import { expect, type Page } from '@playwright/test';
import { assertReadReady, commerceUrl, requiredReadFixture } from './read-assertions';

/** Identity + completed UI read only; this does not establish cross-buyer isolation. */
export async function assertBuyerRead(page: Page, route: string): Promise<void> {
  const main = page.getByRole('main');
  const email = requiredReadFixture('TEST_BUYER_EMAIL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('TEST_BUYER_EMAIL must be an email');
  const text = (value: string) => main.getByText(value, { exact: true });
  const proof = {
    '/buyer': text(email),
    '/buyer/profile': text(email),
    '/buyer/orders': main.getByRole('button', { name: 'View Purchase', exact: true }).or(text('No purchases found')).first(),
    '/buyer/quotes': main.getByRole('table').or(text('No quotations')).first(),
    '/buyer/subscriptions': text('Next Billing').or(text('No subscriptions')).first(),
    '/buyer/library': main.getByRole('button', { name: /^(Go to Course|View Ticket|Download|Book|Access)$/ }).or(text('Your assets are empty')).first(),
  }[route];
  if (!proof) throw new Error('Unknown buyer read route');
  await assertReadReady(page, commerceUrl(route), proof);
  await expect(main).toBeVisible();
}