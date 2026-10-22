import enLegacy from './locales/en.json';
import esLegacy from './locales/es.json';
import frLegacy from './locales/fr.json';
import deLegacy from './locales/de.json';
import jaLegacy from './locales/ja.json';
import enCommerce from './locales/commerce/en.json';
import esCommerce from './locales/commerce/es.json';
import frCommerce from './locales/commerce/fr.json';
import deCommerce from './locales/commerce/de.json';
import jaCommerce from './locales/commerce/ja.json';
import { flattenMessages, type MessageTree } from './locale-messages';
import type { SupportedLocale } from './locale-preferences';
import { spanishWorkspaceMessages } from './locales/workspace/es';
import { screenMessages } from './locales/screens';

/** Raw feature messages, without legacy or English fallback. */
export const commerceMessages: Record<SupportedLocale, Record<string, string>> = {
  en: flattenMessages(enCommerce),
  es: flattenMessages(esCommerce),
  fr: flattenMessages(frCommerce),
  de: flattenMessages(deCommerce),
  ja: flattenMessages(jaCommerce),
};

function ownMessages(locale: SupportedLocale, legacy: MessageTree): Record<string, string> {
  return {
    ...flattenMessages(legacy),
    ...(locale === 'es' ? spanishWorkspaceMessages : {}),
    ...screenMessages[locale],
    ...commerceMessages[locale],
  };
}

/** Each language's own entries, without fallback, for coverage checks. */
export const rawLocaleMessages: Record<SupportedLocale, Record<string, string>> = {
  en: ownMessages('en', enLegacy),
  es: ownMessages('es', esLegacy),
  fr: ownMessages('fr', frLegacy),
  de: ownMessages('de', deLegacy),
  ja: ownMessages('ja', jaLegacy),
};

/** Shared client/document catalog; preserve English fallback for incomplete languages. */
export const localeMessages: Record<SupportedLocale, Record<string, string>> = {
  en: rawLocaleMessages.en,
  es: { ...rawLocaleMessages.en, ...rawLocaleMessages.es },
  fr: { ...rawLocaleMessages.en, ...rawLocaleMessages.fr },
  de: { ...rawLocaleMessages.en, ...rawLocaleMessages.de },
  ja: { ...rawLocaleMessages.en, ...rawLocaleMessages.ja },
};