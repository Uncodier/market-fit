"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocalization } from './LocalizationContext';
import { resolveLocalCurrency } from '../lib/locale-currency';
import { convertAmount, formatDisplayCurrency } from '../lib/fx';

export type CurrencyMode = 'local' | 'usd';

interface DisplayCurrencyContextType {
  mode: CurrencyMode;
  setMode: (mode: CurrencyMode) => void;
  localCurrency: string;
  displayCurrency: string;
  rates: Record<string, number>;
  formatPrice: (amount: number, sourceCurrency?: string) => string;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextType | undefined>(undefined);

export const DisplayCurrencyProvider = ({ children, initialCountry }: { children: ReactNode, initialCountry?: string }) => {
  const { locale } = useLocalization();
  const [mode, setModeState] = useState<CurrencyMode>('local');
  const [localCurrency, setLocalCurrency] = useState<string>('USD');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Resolve local currency
    const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
    const resolved = resolveLocalCurrency({
      country: initialCountry,
      language: browserLang,
      uiLocale: locale
    });
    setLocalCurrency(resolved);

    // 2. Load preferred mode from localStorage
    const savedMode = localStorage.getItem('makinari-currency-mode') as CurrencyMode;
    if (savedMode === 'local' || savedMode === 'usd') {
      setModeState(savedMode);
    }

    // 3. Fetch FX rates.
    // On www, try same-origin rewrite first, then app.makinari.com.
    const isWww = typeof window !== 'undefined' && window.location.hostname === 'www.makinari.com';
    const fxUrls = isWww
      ? ['/api/fx/rates', 'https://app.makinari.com/api/fx/rates']
      : ['/api/fx/rates'];

    ;(async () => {
      for (const fxUrl of fxUrls) {
        try {
          const res = await fetch(fxUrl, { credentials: 'omit' });
          if (!res.ok) continue;
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) continue;
          const data = await res.json();
          if (data?.rates) {
            setRates(data.rates);
            return;
          }
        } catch {
          // try next URL
        }
      }
      console.error('Failed to load FX rates');
    })();

    setMounted(true);
  }, [initialCountry, locale]);

  const setMode = (newMode: CurrencyMode) => {
    setModeState(newMode);
    localStorage.setItem('makinari-currency-mode', newMode);
  };

  const displayCurrency = mode === 'usd' ? 'USD' : localCurrency;

  const formatPrice = useCallback((amount: number, sourceCurrency: string = 'USD'): string => {
    if (!mounted) {
      return formatDisplayCurrency(amount, sourceCurrency);
    }
    
    if (sourceCurrency.toUpperCase() === displayCurrency.toUpperCase()) {
      return formatDisplayCurrency(amount, displayCurrency);
    }

    const converted = convertAmount(amount, sourceCurrency, displayCurrency, rates);
    
    if (converted !== null) {
      return formatDisplayCurrency(converted, displayCurrency);
    }

    // Fallback if no rates available
    return formatDisplayCurrency(amount, sourceCurrency);
  }, [mounted, displayCurrency, rates]);

  return (
    <DisplayCurrencyContext.Provider value={{ mode, setMode, localCurrency, displayCurrency, rates, formatPrice }}>
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
