export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja'];
const LOCALE_KEY = 'makinari-locale';
const CHANGE_EVENT = 'makinari-locale-changed';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value);
}

export function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(language) ? language : null;
}

export function localeStorageKey(scope?: string | null): string {
  return scope ? `${LOCALE_KEY}:${scope}` : LOCALE_KEY;
}

export function readStoredLocale(scope?: string | null): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = normalizeLocale(localStorage.getItem(localeStorageKey(scope)));
    if (stored) return stored;
  } catch {
    // Cookies still support public visitors when browser storage is blocked.
  }
  // The legacy cookie belongs to the public visitor, not any signed-in account.
  if (scope) return null;
  const match = document.cookie.match(/(?:^|; )makinari-locale=([^;]+)/);
  return normalizeLocale(match?.[1]);
}

export function persistLocale(locale: SupportedLocale, scope?: string | null): void {
  try {
    localStorage.setItem(localeStorageKey(scope), locale);
  } catch {
    // The provider keeps the current selection in memory if storage is blocked.
  }
  if (!scope) {
    document.cookie = `${LOCALE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeLocale(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function profileLocaleKey(userId: string): [string, string] {
  return ['profile-language', userId];
}