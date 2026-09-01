import {
  resolveLocalCurrency,
  resolveDisplayCurrency,
  currencyFlag,
  flagEmoji,
} from '../../app/lib/locale-currency';
import { convertAmount, formatDisplayCurrency } from '../../app/lib/fx';

describe('Locale and Currency Resolution', () => {
  it('resolves currency from exact country code', () => {
    expect(resolveLocalCurrency({ country: 'MX' })).toBe('MXN');
    expect(resolveLocalCurrency({ country: 'FR' })).toBe('EUR');
    expect(resolveLocalCurrency({ country: 'GB' })).toBe('GBP');
  });

  it('resolves currency from navigator.language fallback', () => {
    expect(resolveLocalCurrency({ language: 'es-MX' })).toBe('MXN');
    expect(resolveLocalCurrency({ language: 'en-GB' })).toBe('GBP');
  });

  it('resolves currency from app uiLocale', () => {
    expect(resolveLocalCurrency({ uiLocale: 'ja' })).toBe('JPY');
    expect(resolveLocalCurrency({ uiLocale: 'de' })).toBe('EUR');
  });

  it('falls back to USD', () => {
    expect(resolveLocalCurrency({})).toBe('USD');
    expect(resolveLocalCurrency({ country: 'XX' })).toBe('USD');
  });

  it('prioritizes country over language over uiLocale', () => {
    // Country FR (EUR) should win over language es-MX (MXN)
    expect(resolveLocalCurrency({ country: 'FR', language: 'es-MX', uiLocale: 'ja' })).toBe('EUR');
    
    // Language es-MX (MXN) should win over uiLocale ja (JPY)
    expect(resolveLocalCurrency({ language: 'es-MX', uiLocale: 'ja' })).toBe('MXN');
  });
});

describe('Display currency priority', () => {
  it('uses the site currency when the visitor has no preference', () => {
    expect(
      resolveDisplayCurrency({
        mode: 'store',
        storeCurrency: 'MXN',
        localCurrency: 'GBP',
        sourceCurrency: 'USD',
      }),
    ).toBe('MXN');
  });

  it('defaults to store mode when mode is omitted', () => {
    expect(
      resolveDisplayCurrency({
        storeCurrency: 'MXN',
        localCurrency: 'GBP',
        sourceCurrency: 'USD',
      }),
    ).toBe('MXN');
  });

  it('uses local currency only when the user chose local', () => {
    expect(
      resolveDisplayCurrency({
        mode: 'local',
        storeCurrency: 'USD',
        localCurrency: 'MXN',
        sourceCurrency: 'EUR',
      }),
    ).toBe('MXN');
  });

  it('falls back to the product currency when the site has none', () => {
    expect(
      resolveDisplayCurrency({
        mode: 'store',
        storeCurrency: null,
        localCurrency: 'GBP',
        sourceCurrency: 'EUR',
      }),
    ).toBe('EUR');
  });

  it('does not let IP/local region win over site or an explicit preference', () => {
    expect(
      resolveDisplayCurrency({
        mode: 'store',
        storeCurrency: 'USD',
        localCurrency: 'EUR',
        sourceCurrency: 'MXN',
      }),
    ).toBe('USD');
    expect(
      resolveDisplayCurrency({
        mode: 'EUR',
        storeCurrency: 'USD',
        localCurrency: 'MXN',
        sourceCurrency: 'GBP',
      }),
    ).toBe('EUR');
  });

  it('falls back to USD when nothing is set', () => {
    expect(resolveDisplayCurrency({})).toBe('USD');
    expect(resolveDisplayCurrency({ mode: 'store', localCurrency: 'JPY' })).toBe('USD');
  });
});

describe('FX Conversion', () => {
  const mockRates = {
    'EUR': 0.9,
    'MXN': 18.0,
    'GBP': 0.8
  }; // Base USD

  it('returns same amount if currencies match', () => {
    expect(convertAmount(100, 'USD', 'USD', mockRates)).toBe(100);
    expect(convertAmount(100, 'EUR', 'EUR', mockRates)).toBe(100);
  });

  it('converts USD to target', () => {
    expect(convertAmount(100, 'USD', 'EUR', mockRates)).toBe(90);
    expect(convertAmount(100, 'USD', 'MXN', mockRates)).toBe(1800);
  });

  it('converts source to USD', () => {
    expect(convertAmount(90, 'EUR', 'USD', mockRates)).toBe(100);
  });

  it('converts between non-USD currencies', () => {
    // 90 EUR -> 100 USD -> 1800 MXN
    expect(convertAmount(90, 'EUR', 'MXN', mockRates)).toBe(1800);
  });

  it('returns null if rates missing', () => {
    expect(convertAmount(100, 'USD', 'JPY', mockRates)).toBeNull();
    expect(convertAmount(100, 'USD', 'EUR', {})).toBeNull();
  });
});

describe('Currency Flags', () => {
  it('maps currency codes to flag emojis', () => {
    expect(currencyFlag('USD')).toBe(flagEmoji('US'));
    expect(currencyFlag('MXN')).toBe(flagEmoji('MX'));
    expect(currencyFlag('EUR')).toBe('🇪🇺');
  });
});

describe('Display Currency Formatting', () => {
  it('formats decimals for standard currencies', () => {
    // Note: JS Intl.NumberFormat space characters can be non-breaking depending on node version, so we check inclusion
    const formatted = formatDisplayCurrency(10.5, 'USD');
    expect(formatted).toContain('$10.50');
  });

  it('omits decimals for zero-decimal currencies', () => {
    const formatted = formatDisplayCurrency(1000, 'JPY');
    expect(formatted).toContain('1,000');
    expect(formatted).not.toContain('.00');
  });
});
