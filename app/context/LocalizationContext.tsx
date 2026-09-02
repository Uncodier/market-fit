"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef, ReactNode } from 'react';
import enTranslations from './locales/en.json';
import esOverlay from './locales/es.json';
import frOverlay from './locales/fr.json';
import deOverlay from './locales/de.json';
import jaOverlay from './locales/ja.json';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja';

const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja'];
const LOCALE_COOKIE = 'makinari-locale';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

interface LocalizationContextType {
  locale: SupportedLocale;
  /** True after the initial localStorage / geo / browser resolution has run. */
  isReady: boolean;
  setLocale: (locale: SupportedLocale) => void;
  /** Apply site default or browser location when the visitor has no saved preference. Does not persist. */
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

function mergeOverlay(overlay: Record<string, string>) {
  return { ...enTranslations, ...overlay };
}

const translationCache: Record<SupportedLocale, Record<string, string>> = {
  en: enTranslations,
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

export async function loadLocaleMessages(locale: SupportedLocale): Promise<any> {
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

const localizedAssets: Record<SupportedLocale, Record<string, string>> = {
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
  if (isSupportedLocale(storedLocale)) return storedLocale;
  if (isSupportedLocale(siteLocale)) return siteLocale;
  if (country && countryToLocale[country.toUpperCase()]) return countryToLocale[country.toUpperCase()];
  if (browserLanguage) {
    const lang = browserLanguage.split('-')[0];
    if (isSupportedLocale(lang)) return lang;
  }
  return defaultLocale;
}

export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromStorage = localStorage.getItem('makinari-locale');
    if (isSupportedLocale(fromStorage)) return fromStorage;
  } catch {
    // ignore
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  return isSupportedLocale(match?.[1]) ? match[1] : null;
}

function clearLocalePending() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("locale-pending");
}

function persistLocale(locale: SupportedLocale) {
  try {
    localStorage.setItem('makinari-locale', locale);
  } catch {
    // ignore
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

function resolveInitialLocale(): SupportedLocale {
  const stored = readStoredLocale();
  if (stored) return stored;
  return defaultLocale;
}

if (typeof window !== 'undefined') {
  const stored = readStoredLocale();
  if (stored && stored !== 'en' && !translationCache[stored]) {
    void loadLocaleMessages(stored);
  }
}

export const LocalizationProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const [messages, setMessages] = useState<any>(enTranslations);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const next = resolveInitialLocale();
    const cached = translationCache[next];
    setLocaleState(next);
    if (cached) {
      setMessages(cached);
      document.documentElement.lang = next;
      clearLocalePending();
    }
    setMounted(true);
    const timeout = window.setTimeout(clearLocalePending, 2000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const cached = translationCache[locale];
    if (cached) {
      setMessages(cached);
      document.documentElement.lang = locale;
      clearLocalePending();
      return;
    }
    loadLocaleMessages(locale).then((loaded: any) => {
      if (cancelled) return;
      setMessages(loaded);
      document.documentElement.lang = locale;
      clearLocalePending();
    }).catch(clearLocalePending);
    return () => {
      cancelled = true;
    };
  }, [locale, mounted]);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);
    document.documentElement.lang = newLocale;
  };

  const localeApplyGeneration = useRef(0);

  useEffect(() => {
    return () => {
      localeApplyGeneration.current += 1;
    };
  }, []);

  const applyUnresolvedLocale = useCallback(async (siteLocale?: string | null) => {
    if (readStoredLocale()) return; // User preference wins
    
    const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
    const resolved = resolveDisplayLocale({
      storedLocale: null,
      siteLocale,
      browserLanguage: browserLang,
    });

    const applyGeneration = ++localeApplyGeneration.current;
    const applyResolved = (loaded: Record<string, string>) => {
      if (applyGeneration !== localeApplyGeneration.current) return;
      setLocaleState(resolved);
      setMessages(loaded);
      document.documentElement.lang = resolved;
      clearLocalePending();
    };

    const cached = translationCache[resolved];
    if (cached) {
      applyResolved(cached);
      return;
    }

    try {
      const loaded = await loadLocaleMessages(resolved);
      applyResolved(loaded);
    } catch {
      if (applyGeneration === localeApplyGeneration.current) {
        clearLocalePending();
      }
    }
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
    if (!mounted) return localizedAssets[defaultLocale][key] || key;
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
