import type { Locator, Page } from '@playwright/test';
import { localeMessages } from '../../app/context/locale-catalog';
import { isSupportedLocale } from '../../app/context/locale-preferences';

/** Match the settled page language without changing the newly registered profile. */
export function accountButton(page: Page, keys: string[]): Locator {
  const locators = Object.keys(localeMessages).filter(isSupportedLocale).flatMap(locale => keys.map(key => {
    const name = localeMessages[locale][key] || localeMessages.en[key];
    if (!name) throw new Error(`Missing auth journey translation: ${key}`);
    return page.locator(`html[lang="${locale}"]:not(.locale-pending)`).getByRole('button', { name, exact: true });
  }));
  return locators.reduce((combined, locator) => combined.or(locator)).filter({ visible: true }).first();
}