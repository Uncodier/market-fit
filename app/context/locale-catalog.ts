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

/** Raw feature messages, without legacy or English fallback. */
export const commerceMessages: Record<SupportedLocale, Record<string, string>> = {
  en: flattenMessages(enCommerce),
  es: flattenMessages(esCommerce),
  fr: flattenMessages(frCommerce),
  de: flattenMessages(deCommerce),
  ja: flattenMessages(jaCommerce),
};

const legacyEnglish = flattenMessages(enLegacy);

function mergeLocale(locale: SupportedLocale, legacy: MessageTree): Record<string, string> {
  return { ...legacyEnglish, ...flattenMessages(legacy), ...commerceMessages[locale] };
}

/** Shared client/document catalog; feature messages take precedence over legacy copy. */
export const localeMessages: Record<SupportedLocale, Record<string, string>> = {
  en: mergeLocale('en', enLegacy),
  es: mergeLocale('es', esLegacy),
  fr: mergeLocale('fr', frLegacy),
  de: mergeLocale('de', deLegacy),
  ja: mergeLocale('ja', jaLegacy),
};