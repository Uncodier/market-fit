import { resolveDisplayLocale } from '../../app/context/LocalizationContext';

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
