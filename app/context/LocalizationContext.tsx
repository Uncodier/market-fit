"use client";

import React, { createContext, useContext, useState, useLayoutEffect, useCallback, useSyncExternalStore, ReactNode } from 'react';
import enTranslations from './locales/en.json';
import esOverlay from './locales/es.json';
import frOverlay from './locales/fr.json';
import deOverlay from './locales/de.json';
import jaOverlay from './locales/ja.json';
import { flattenMessages, type MessageTree } from './locale-messages';
import { normalizeLocale, persistLocale, readStoredLocale, subscribeLocale, type SupportedLocale } from './locale-preferences';

export { isSupportedLocale, normalizeLocale, readStoredLocale, type SupportedLocale } from './locale-preferences';

interface LocalizationContextType {
  locale: SupportedLocale;
  /** True once browser preferences can be read without a hydration mismatch. */
  isReady: boolean;
  setLocale: (locale: SupportedLocale) => void;
  /** Register a site fallback without persisting it as a user preference. */
  applyUnresolvedLocale: (siteLocale?: string | null) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  getAsset: (key: string) => string;
}

const defaultLocale: SupportedLocale = 'en';

const countryToLocale: Record<string, SupportedLocale> = {
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  MX: 'es',
  ES: 'es',
  AR: 'es',
  CO: 'es',
  FR: 'fr',
  DE: 'de',
  JP: 'ja',
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

function mergeOverlay(overlay: MessageTree) {
  return { ...flattenMessages(enTranslations), ...flattenMessages(overlay) };
}

const translationCache: Record<SupportedLocale, Record<string, string>> = {
  en: flattenMessages(enTranslations),
  es: mergeOverlay(esOverlay),
  fr: mergeOverlay(frOverlay),
  de: mergeOverlay(deOverlay),
  ja: mergeOverlay(jaOverlay),
};

const localeLoaders: Partial<Record<SupportedLocale, () => Promise<Record<string, string>>>> = {
  en: async () => translationCache.en,
  es: async () => translationCache.es,
  fr: async () => translationCache.fr,
  de: async () => translationCache.de,
  ja: async () => translationCache.ja,
};

export async function loadLocaleMessages(locale: SupportedLocale): Promise<Record<string, string>> {
  if (translationCache[locale]) return translationCache[locale];
  const loader = localeLoaders[locale];
  if (typeof loader === 'function') {
    try {
      const loaded = await loader();
      const merged = { ...translationCache.en, ...loaded };
      translationCache[locale] = merged;
      return merged;
    } catch {
      // Fallback
    }
  }
  translationCache[locale] = translationCache.en;
  return translationCache.en;
}

const localizedAssets: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: { 'logo.main': '/images/logo.png', 'hero.image': '/images/hero-en.png' },
};

export function resolveDisplayLocale({
  storedLocale,
  siteLocale,
  country,
  browserLanguage,
}: {
  storedLocale?: string | null;
  siteLocale?: string | null;
  country?: string | null;
  browserLanguage?: string | null;
}): SupportedLocale {
  const stored = normalizeLocale(storedLocale);
  if (stored) return stored;
  const site = normalizeLocale(siteLocale);
  if (site) return site;
  if (country && countryToLocale[country.toUpperCase()]) return countryToLocale[country.toUpperCase()];
  if (browserLanguage) {
    const lang = normalizeLocale(browserLanguage);
    if (lang) return lang;
  }
  return defaultLocale;
}

function clearLocalePending() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("locale-pending");
}

interface LocalizationProviderProps {
  children: ReactNode;
  /** Workspace preferences are isolated from public visitor cookies and other accounts. */
  preferenceScope?: string | null;
  preferredLocale?: string | null;
}

const serverLocale = () => null;
const clientReady = () => true;
const serverReady = () => false;

export const LocalizationProvider = ({ children, preferenceScope, preferredLocale }: LocalizationProviderProps) => {
  const mounted = useSyncExternalStore(subscribeLocale, clientReady, serverReady);
  const getStoredLocale = useCallback(() => readStoredLocale(preferenceScope), [preferenceScope]);
  const storedLocale = useSyncExternalStore(subscribeLocale, getStoredLocale, serverLocale);
  const profileLocale = normalizeLocale(preferredLocale);
  const [selection, setSelection] = useState<{
    scope: string | null | undefined;
    profile: SupportedLocale | null;
    locale: SupportedLocale;
  } | null>(null);
  const [fallbackLocale, setFallbackLocale] = useState<SupportedLocale>(defaultLocale);
  // Explicit selections apply immediately, but cannot leak across accounts or profile changes.
  const selectedLocale = selection?.scope === preferenceScope && selection?.profile === profileLocale
    ? selection?.locale : null;
  const locale = selectedLocale || profileLocale || storedLocale || fallbackLocale;
  // Derive translations in the same render as the locale; effects must not lag behind it.
  const messages = translationCache[locale];

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    clearLocalePending();
  }, [locale]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    const normalized = normalizeLocale(newLocale);
    if (!normalized) return;
    setSelection({ scope: preferenceScope, profile: profileLocale, locale: normalized });
    persistLocale(normalized, preferenceScope);
  }, [preferenceScope, profileLocale]);

  const applyUnresolvedLocale = useCallback(async (siteLocale?: string | null) => {
    setFallbackLocale(resolveDisplayLocale({
      siteLocale,
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
    }));
  }, []);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const raw = messages[key] || translationCache.en?.[key] || key;
    if (!params) return raw;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(value)),
      raw
    );
  };

  const getAsset = (key: string): string => {
    if (!mounted) return localizedAssets[defaultLocale]?.[key] || key;
    return localizedAssets[locale]?.[key] || localizedAssets[defaultLocale]?.[key] || key;
  };

  return (
    <LocalizationContext.Provider value={{ locale, isReady: mounted, setLocale, applyUnresolvedLocale, t, getAsset }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
