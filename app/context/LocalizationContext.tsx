"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';
import deTranslations from './locales/de.json';
import jaTranslations from './locales/ja.json';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja';

interface LocalizationContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  // helper to get localized strings/assets
  t: (key: string) => string; 
  getAsset: (key: string) => string;
}

const defaultLocale: SupportedLocale = 'en';

const countryToLocale: Record<string, SupportedLocale> = {
  // Spanish speaking countries
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es', 
  'EC': 'es', 'GT': 'es', 'CU': 'es', 'DO': 'es', 'HN': 'es', 'PY': 'es', 'SV': 'es', 
  'NI': 'es', 'CR': 'es', 'PA': 'es', 'UY': 'es', 'BO': 'es', 'GQ': 'es', 'PR': 'es',
  // French speaking countries
  'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'CA': 'fr', 'MC': 'fr', 'LU': 'fr',
  // German speaking countries
  'DE': 'de', 'AT': 'de', 'LI': 'de',
  // Japanese speaking countries
  'JP': 'ja',
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const translations: Record<SupportedLocale, Record<string, string>> = {
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  de: deTranslations,
  ja: jaTranslations,
};

// Map for localized assets like images
const localizedAssets: Record<SupportedLocale, Record<string, string>> = {
  en: {
    'logo.main': '/images/logo.png',
    'hero.image': '/images/hero-en.png',
  },
  es: {
    'logo.main': '/images/logo.png', // Fallback or localized
    'hero.image': '/images/hero-es.png',
  },
  fr: {
    'logo.main': '/images/logo.png',
    'hero.image': '/images/hero-fr.png',
  },
  de: {
    'logo.main': '/images/logo.png',
    'hero.image': '/images/hero-de.png',
  },
  ja: {
    'logo.main': '/images/logo.png',
    'hero.image': '/images/hero-ja.png',
  },
};

export const LocalizationProvider = ({ children, initialCountry }: { children: ReactNode, initialCountry?: string }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Try to load from localStorage on mount
    const savedLocale = localStorage.getItem('makinari-locale') as SupportedLocale;
    if (savedLocale && Object.keys(translations).includes(savedLocale)) {
      setLocaleState(savedLocale);
    } else {
      // 1. Try to guess from initialCountry (passed from server headers)
      if (initialCountry && countryToLocale[initialCountry]) {
        setLocaleState(countryToLocale[initialCountry]);
      } else {
        // 2. Try to guess from browser
        const browserLang = navigator.language.split('-')[0] as SupportedLocale;
        if (Object.keys(translations).includes(browserLang)) {
          setLocaleState(browserLang);
        }
      }
    }
    setMounted(true);
  }, [initialCountry]);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem('makinari-locale', newLocale);
    // Optionally update the lang attribute on html tag
    document.documentElement.lang = newLocale;
  };

  const t = (key: string): string => {
    if (!mounted) return translations[defaultLocale][key] || key;
    return translations[locale]?.[key] || translations[defaultLocale]?.[key] || key;
  };

  const getAsset = (key: string): string => {
    if (!mounted) return localizedAssets[defaultLocale][key] || key;
    return localizedAssets[locale]?.[key] || localizedAssets[defaultLocale]?.[key] || key;
  };

  return (
    <LocalizationContext.Provider value={{ locale, setLocale, t, getAsset }}>
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
