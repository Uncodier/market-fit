"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocalization } from './LocalizationContext';
import {
  DEFAULT_DISPLAY_CURRENCY_MODE,
  normalizeCurrencyCode,
  resolveDisplayCurrency,
  resolveLocalCurrency,
} from '../lib/locale-currency';
import { convertAmount, formatDisplayCurrency } from '../lib/fx';

export type CurrencyMode = string;

interface DisplayCurrencyContextType {
  mode: CurrencyMode;
  setMode: (mode: CurrencyMode) => void;
  localCurrency: string;
  displayCurrency: string;
  rates: Record<string, number>;
  storeCurrency: string | null;
  setStoreCurrency: (currency: string | null) => void;
  formatPrice: (amount: number, sourceCurrency?: string) => string;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextType | undefined>(undefined);

export const DisplayCurrencyProvider = ({ children, initialCountry }: { children: ReactNode, initialCountry?: string }) => {
  const { locale } = useLocalization();
  const [mode, setModeState] = useState<CurrencyMode>(DEFAULT_DISPLAY_CURRENCY_MODE);
  const [localCurrency, setLocalCurrency] = useState<string>('USD');
  const [storeCurrency, setStoreCurrencyState] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
    const resolved = resolveLocalCurrency({
      country: initialCountry,
      language: browserLang,
      uiLocale: locale
    });
    setLocalCurrency(resolved);

    const savedMode = localStorage.getItem('makinari-currency-mode');
    if (savedMode) {
      setModeState(savedMode);
    }

    const isWww = typeof window !== 'undefined' && window.location.hostname === 'www.makinari.com';
    const fxUrls = isWww
      ? ['/api/fx/rates', 'https://app.makinari.com/api/fx/rates']
      : ['/api/fx/rates'];

    ;(async () => {
      for (const fxUrl of fxUrls) {
        try {
          const res = await fetch(fxUrl, { credentials: 'omit' });
          if (!res.ok) {
            console.warn(`[fx] Fetch to ${fxUrl} returned ${res.status}`);
            continue;
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn(`[fx] Fetch to ${fxUrl} returned non-json content-type: ${contentType}`);
            continue;
          }
          const data = await res.json();
          if (data?.rates) {
            setRates(data.rates);
            return;
          } else {
            console.warn(`[fx] Fetch to ${fxUrl} returned no rates:`, data);
          }
        } catch (error) {
          console.warn(`[fx] Fetch to ${fxUrl} threw error:`, error);
        }
      }
      console.warn('Failed to load FX rates, falling back to source currency without conversion.');
    })();

    setMounted(true);
  }, [initialCountry, locale]);

  const setMode = (newMode: CurrencyMode) => {
    setModeState(newMode);
    localStorage.setItem('makinari-currency-mode', newMode);
  };

  const setStoreCurrency = useCallback((currency: string | null) => {
    setStoreCurrencyState(normalizeCurrencyCode(currency));
  }, []);

  const displayCurrency = resolveDisplayCurrency({
    mode,
    storeCurrency,
    localCurrency,
  });

  const formatPrice = useCallback((amount: number, sourceCurrency: string = 'USD'): string => {
    if (!mounted) {
      return formatDisplayCurrency(amount, sourceCurrency);
    }

    const target = resolveDisplayCurrency({
      mode,
      storeCurrency,
      localCurrency,
      sourceCurrency,
    });

    if (sourceCurrency.toUpperCase() === target.toUpperCase()) {
      return formatDisplayCurrency(amount, target);
    }

    const converted = convertAmount(amount, sourceCurrency, target, rates);

    if (converted !== null) {
      return formatDisplayCurrency(converted, target);
    }

    return formatDisplayCurrency(amount, sourceCurrency);
  }, [mounted, mode, storeCurrency, localCurrency, rates]);

  return (
    <DisplayCurrencyContext.Provider value={{ mode, setMode, localCurrency, displayCurrency, rates, storeCurrency, setStoreCurrency, formatPrice }}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
};

export const useDisplayCurrency = () => {
  const context = useContext(DisplayCurrencyContext);
  if (context === undefined) {
    throw new Error('useDisplayCurrency must be used within a DisplayCurrencyProvider');
  }
  return context;
};
