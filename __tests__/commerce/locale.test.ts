import { loadLocaleMessages, resolveDisplayLocale } from '../../app/context/LocalizationContext';

describe('Display locale priority', () => {
  it('uses the user stored preference over anything else', () => {
    expect(
      resolveDisplayLocale({
        storedLocale: 'en',
        siteLocale: 'es',
        country: 'MX',
        browserLanguage: 'fr-FR',
      }),
    ).toBe('en');
  });

  it('uses the site default when there is no user preference', () => {
    expect(
      resolveDisplayLocale({
        storedLocale: null,
        siteLocale: 'es',
        browserLanguage: 'en-GB',
      }),
    ).toBe('es');
  });

  it('falls back to location/browser language when there is no user or site preference', () => {
    expect(
      resolveDisplayLocale({
        storedLocale: null,
        siteLocale: null,
        browserLanguage: 'es-MX',
      }),
    ).toBe('es');
  });

  it('does not let country or IP win over site preference', () => {
    expect(
      resolveDisplayLocale({
        storedLocale: null,
        siteLocale: 'de',
        country: 'FR',
      }),
    ).toBe('de');
  });

  it('falls back to en when nothing is set', () => {
    expect(resolveDisplayLocale({})).toBe('en');
  });

  it('ignores unsupported locales', () => {
    expect(
      resolveDisplayLocale({
        storedLocale: 'xx',
        siteLocale: 'es',
      }),
    ).toBe('es');
    
    expect(
      resolveDisplayLocale({
        storedLocale: null,
        siteLocale: 'yy',
        browserLanguage: 'ja-JP',
      }),
    ).toBe('ja');
  });
});

describe('loadLocaleMessages', () => {
  const expectedTickets: Record<'es' | 'fr' | 'de' | 'ja', string> = {
    es: 'Obtener entradas',
    fr: 'Obtenir des billets',
    de: 'Tickets holen',
    ja: 'チケットを取得',
  };

  it.each(['es', 'fr', 'de', 'ja'] as const)(
    'loads translated storefront keys overlaid on English for %s',
    async (locale) => {
      const messages = await loadLocaleMessages(locale);
      expect(messages['pdp.getTickets']).toBe(expectedTickets[locale]);
      expect(messages['marketplace.add']).not.toBe('Add to Cart');
      expect(messages['checkout.success.title']).not.toBe('Order Confirmed');
      expect(messages['dashboard.analytics.clientCohort.title']).toBe('Client Cohort Analysis');
    },
  );

  it('returns English catalog for en', async () => {
    const messages = await loadLocaleMessages('en');
    expect(messages['checkout.success.title']).toBe('Order Confirmed');
    expect(messages['pdp.getTickets']).toBe('Get Tickets');
  });
});
