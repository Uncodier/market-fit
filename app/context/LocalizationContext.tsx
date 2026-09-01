"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';
import enTranslations from './locales/en.json';

export type SupportedLocale = 'en';

const SUPPORTED_LOCALES: SupportedLocale[] = ['en'];
const LOCALE_COOKIE = 'makinari-locale';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

interface LocalizationContextType {
  locale: SupportedLocale;
  /** True after the initial localStorage / geo / browser resolution has run. */
  isReady: boolean;
  setLocale: (locale: SupportedLocale) => void;
  /** Apply site default when the visitor has no saved preference. Does not persist. */
  applySiteDefaultLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getAsset: (key: string) => string;
}

const defaultLocale: SupportedLocale = 'en';

const countryToLocale: Record<string, SupportedLocale> = {};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const localeLoaders: Record<SupportedLocale, () => Promise<any>> = {
  en: async () => enTranslations,
};

const translationCache: any = {
  en: enTranslations,
};

const localizedAssets: Record<SupportedLocale, Record<string, string>> = {
  en: { 'logo.main': '/images/logo.png', 'hero.image': '/images/hero-en.png' },
};

function readStoredLocale(): SupportedLocale | null {
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

function resolveInitialLocale(initialCountry?: string): SupportedLocale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (initialCountry && countryToLocale[initialCountry]) return countryToLocale[initialCountry];
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language.split('-')[0];
    if (isSupportedLocale(browserLang)) return browserLang;
  }
  return defaultLocale;
}

if (typeof window !== 'undefined') {
  const stored = readStoredLocale();
  if (stored && stored !== 'en' && !translationCache[stored]) {
    void (localeLoaders[stored] as any)().then((loaded: any) => {
      translationCache[stored] = loaded;
    });
  }
}

export const LocalizationProvider = ({ children, initialCountry }: { children: ReactNode, initialCountry?: string }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const [messages, setMessages] = useState<any>(enTranslations);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const next = resolveInitialLocale(initialCountry);
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
  }, [initialCountry]);

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
    (localeLoaders[locale] as any)().then((loaded: any) => {
      if (cancelled) return;
      translationCache[locale] = loaded;
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

  const applySiteDefaultLocale = (siteLocale: SupportedLocale) => {
    if (!isSupportedLocale(siteLocale)) return;
    if (readStoredLocale()) return;
    setLocaleState(siteLocale);
    document.documentElement.lang = siteLocale;
  };

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
    <LocalizationContext.Provider value={{ locale, isReady: mounted, setLocale, applySiteDefaultLocale, t, getAsset }}>
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
