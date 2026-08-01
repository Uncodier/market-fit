export const countryToCurrency: Record<string, string> = {
  // North America
  US: 'USD',
  CA: 'CAD',
  MX: 'MXN',
  // Europe
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  GB: 'GBP',
  CH: 'CHF',
  // Asia
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  // Oceania
  AU: 'AUD',
  NZ: 'NZD',
  // South America
  BR: 'BRL',
  CO: 'COP',
  CL: 'CLP',
  AR: 'ARS',
  PE: 'PEN',
};

export const localeToCurrency: Record<string, string> = {
  en: 'USD',
  es: 'MXN', // Defaulting es to MXN or EUR depending on region, but 'es' fallback is MXN in our plan
  fr: 'EUR',
  de: 'EUR',
  ja: 'JPY',
};

/** Representative country/region code for currency flag display */
export const currencyToFlagCode: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  MXN: 'MX',
  GBP: 'GB',
  CAD: 'CA',
  AUD: 'AU',
  JPY: 'JP',
  BRL: 'BR',
  COP: 'CO',
  CLP: 'CL',
  ARS: 'AR',
  PEN: 'PE',
  CHF: 'CH',
  CNY: 'CN',
  INR: 'IN',
  NZD: 'NZ',
};

/** Convert ISO 3166-1 alpha-2 (or EU) to a flag emoji */
export function flagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (upper === 'EU') return '🇪🇺';
  if (upper.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + upper.charCodeAt(0) - 65,
    A + upper.charCodeAt(1) - 65,
  );
}

export function currencyFlag(currency: string): string {
  const code = currencyToFlagCode[currency.toUpperCase()] || 'US';
  return flagEmoji(code);
}

interface ResolveLocalCurrencyParams {
  country?: string;
  language?: string;
  uiLocale?: string;
}

export function resolveLocalCurrency({
  country,
  language,
  uiLocale,
}: ResolveLocalCurrencyParams): string {
  if (country && countryToCurrency[country.toUpperCase()]) {
    return countryToCurrency[country.toUpperCase()];
  }

  if (language) {
    const langParts = language.split('-');
    if (langParts.length > 1) {
      const region = langParts[1].toUpperCase();
      if (countryToCurrency[region]) {
        return countryToCurrency[region];
      }
    }
  }

  if (uiLocale && localeToCurrency[uiLocale]) {
    return localeToCurrency[uiLocale];
  }

  return 'USD';
}
