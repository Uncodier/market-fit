import { expect, type Locator, type Page } from '@playwright/test';
import { localeMessages } from '../../app/context/locale-catalog';
import { isSupportedLocale, type SupportedLocale } from '../../app/context/locale-preferences';
import { assertReadReady, commerceUrl, requiredReadFixture } from './read-assertions';

const locales = Object.keys(localeMessages).filter(isSupportedLocale);
const buyerRoutes = ['/buyer', '/buyer/profile', '/buyer/orders', '/buyer/quotes', '/buyer/subscriptions', '/buyer/library'];
const readErrorKeys = ['buyer.home.failedToLoad', 'buyer.orders.errorLoading', 'buyer.quotes.errorLoading',
  'buyer.subscriptions.errorLoading', 'buyer.library.errorLoading'];

function message(locale: SupportedLocale, key: string): string {
  // Use the same merged catalog and English fallback as the app's t().
  const value = localeMessages[locale][key] || localeMessages.en[key];
  if (!value?.trim()) throw new Error(`Missing buyer read translation: ${locale}/${key}`);
  return value;
}

function any(locators: Locator[]): Locator {
  return locators.reduce((combined, locator) => combined.or(locator));
}

function routeProof(main: Locator, route: string, locale: SupportedLocale, email: string): Locator {
  const text = (key: string) => main.getByText(message(locale, key), { exact: true });
  switch (route) {
    case '/buyer':
    case '/buyer/profile': return main.getByText(email, { exact: true });
    case '/buyer/orders': return main.getByRole('button', {
      name: message(locale, 'buyer.orders.viewPurchase'), exact: true,
    }).or(text('buyer.orders.empty.title'));
    case '/buyer/quotes': return main.getByRole('table').or(text('buyer.quotes.empty.title'));
    case '/buyer/subscriptions': return text('buyer.subscriptions.table.nextBilling').or(text('buyer.subscriptions.empty.title'));
    case '/buyer/library': return any(['course', 'ticket', 'file', 'book', 'access'].map(action =>
      main.getByRole('button', { name: message(locale, `buyer.library.actions.${action}`), exact: true }),
    )).or(text('buyer.library.empty.title'));
    default: throw new Error('Unknown buyer read route');
  }
}

/** Identity + completed UI read only; this does not establish cross-buyer isolation. */
export async function assertBuyerRead(page: Page, route: string): Promise<void> {
  const main = page.getByRole('main');
  const email = requiredReadFixture('TEST_BUYER_EMAIL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('TEST_BUYER_EMAIL must be an email');
  if (!buyerRoutes.includes(route)) throw new Error('Unknown buyer read route');
  await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^(${locales.join('|')})$`), { timeout: 30_000 });
  // Resolve against the live html lang on every retry, not a pre-hydration snapshot.
  // A different locale's text is never proof, even while the app changes language.
  const proof = any(locales.map(locale => routeProof(
    page.locator(`html[lang="${locale}"]:not(.locale-pending)`).getByRole('main'), route, locale, email,
  ))).filter({ visible: true }).first();
  await assertReadReady(page, commerceUrl(route), proof);
  await expect(main).toBeVisible();
  await expect(page.locator('html.locale-pending')).toHaveCount(0, { timeout: 30_000 });
  await expect(any(locales.map(locale => page.getByText(message(locale, 'buyer.layout.loading'), { exact: true })))
    .filter({ visible: true })).toHaveCount(0, { timeout: 30_000 });
  // Include every supported translation so a stale/mixed-locale error cannot pass.
  await expect(any(locales.flatMap(locale => readErrorKeys.map(key =>
    page.getByText(message(locale, key), { exact: true }),
  ))).filter({ visible: true })).toHaveCount(0);
  await expect(proof).toBeVisible();
}
