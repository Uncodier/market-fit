import React, { useLayoutEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context';
import { AccountLocalizationProvider } from '@/app/providers/AccountLocalizationProvider';
import { LocalizationProvider, normalizeLocale, useLocalization } from '@/app/context/LocalizationContext';
import { localeStorageKey, persistLocale, readStoredLocale } from '@/app/context/locale-preferences';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockAbort = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => ({ select: mockSelect }) }),
}));

function Probe({ siteLocale = 'es' }: { siteLocale?: string }) {
  const { locale, t, setLocale, applyUnresolvedLocale, isReady } = useLocalization();
  useLayoutEffect(() => {
    if (isReady) void applyUnresolvedLocale(siteLocale);
  }, [siteLocale, isReady, applyUnresolvedLocale]);
  return <>
    <span data-testid="locale">{locale}</span>
    <span data-testid="translation">{t('checkout.success.title')}</span>
    <button onClick={() => setLocale('de')}>Choose German</button>
  </>;
}

function auth(userId: string | null, isLoading = false): AuthContextValue {
  return {
    user: userId ? { id: userId } as AuthContextValue['user'] : null,
    isAuthenticated: Boolean(userId), isLoading,
    signInWithEmail: jest.fn(), signInWithOAuth: jest.fn(),
    signUpWithEmail: jest.fn(), signOut: jest.fn(),
  };
}

function accountTree(userId: string | null, workspace = true, isLoading = false) {
  return <AuthContext.Provider value={auth(userId, isLoading)}>
    <AccountLocalizationProvider workspace={workspace}><Probe /></AccountLocalizationProvider>
  </AuthContext.Provider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.cookie = 'makinari-locale=; Max-Age=0; path=/';
  mockSelect.mockImplementation(() => ({ eq: mockEq }));
  mockEq.mockImplementation(() => ({ abortSignal: mockAbort }));
  mockAbort.mockImplementation(() => ({ maybeSingle: mockMaybeSingle }));
  mockMaybeSingle.mockResolvedValue({ data: { language: 'es' }, error: null });
});

describe('account language resolution', () => {
  it('uses the saved profile ahead of a stale browser locale and site default', async () => {
    localStorage.setItem('makinari-locale', 'en');
    localStorage.setItem(localeStorageKey('user:account-a'), 'fr');
    document.cookie = 'makinari-locale=en; path=/';
    render(<SWRConfig value={{ provider: () => new Map() }}>{accountTree('account-a')}</SWRConfig>);
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('es'));
    expect(screen.getByTestId('translation')).toHaveTextContent('Pedido confirmado');
    expect(document.documentElement.lang).toBe('es');
    expect(mockSelect).toHaveBeenCalledWith('language');
    expect(mockEq).toHaveBeenCalledWith('id', 'account-a');
  });

  it('falls back to the site without inheriting a public visitor preference', async () => {
    localStorage.setItem('makinari-locale', 'en');
    mockMaybeSingle.mockResolvedValue({ data: { language: null }, error: null });
    render(<SWRConfig value={{ provider: () => new Map() }}>{accountTree('account-a')}</SWRConfig>);
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('does not use the previous account while the next profile is loading', async () => {
    let resolveNext!: (result: unknown) => void;
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { language: 'fr' }, error: null })
      .mockReturnValueOnce(new Promise(resolve => { resolveNext = resolve; }));
    const cache = new Map();
    const tree = (id: string) => <SWRConfig value={{ provider: () => cache, keepPreviousData: true }}>
      {accountTree(id)}
    </SWRConfig>;
    const view = render(tree('account-a'));
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('fr'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose German' }));
    view.rerender(tree('account-b'));
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
    await act(async () => { resolveNext({ data: { language: 'ja' }, error: null }); });
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('ja'));
    expect(readStoredLocale('user:account-b')).toBeNull();
  });

  it('ignores an old account response that finishes after switching users', async () => {
    let resolveOld!: (result: unknown) => void;
    mockMaybeSingle
      .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ data: { language: 'de' }, error: null });
    const cache = new Map();
    const tree = (id: string) => <SWRConfig value={{ provider: () => cache }}>{accountTree(id)}</SWRConfig>;
    const view = render(tree('account-a'));
    view.rerender(tree('account-b'));
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('de'));
    await act(async () => { resolveOld({ data: { language: 'fr' }, error: null }); });
    expect(screen.getByTestId('locale')).toHaveTextContent('de');
  });

  it('preserves public storefront preferences without querying a signed-in profile', () => {
    localStorage.setItem('makinari-locale', 'fr');
    render(<SWRConfig value={{ provider: () => new Map() }}>{accountTree('account-a', false)}</SWRConfig>);
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('does not fetch a profile until authentication finishes', () => {
    render(<SWRConfig value={{ provider: () => new Map() }}>{accountTree('account-a', true, true)}</SWRConfig>);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('keeps the site fallback when the profile read fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      {accountTree('account-a')}
    </SWRConfig>);
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('does not fetch a profile for anonymous visitors', () => {
    render(<SWRConfig value={{ provider: () => new Map() }}>{accountTree(null)}</SWRConfig>);
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('revalidates a saved profile when another tab changes the account preference', async () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {accountTree('account-a')}
    </SWRConfig>);
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
    mockMaybeSingle.mockResolvedValue({ data: { language: 'de' }, error: null });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: localeStorageKey('user:account-a'), newValue: 'de',
      }));
    });
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('de'));
  });
});

describe('scoped browser preferences', () => {
  it('normalizes regional codes and rejects unsupported values', () => {
    expect(normalizeLocale(' ES-mx ')).toBe('es');
    expect(normalizeLocale('fr_CA')).toBe('fr');
    expect(normalizeLocale('pt-BR')).toBeNull();
    expect(normalizeLocale({ language: 'es' })).toBeNull();
  });

  it('keeps account persistence separate from public cookies', () => {
    persistLocale('en');
    persistLocale('es', 'user:account-a');
    expect(readStoredLocale()).toBe('en');
    expect(readStoredLocale('user:account-a')).toBe('es');
    expect(readStoredLocale('user:account-b')).toBeNull();
  });

  it('uses the public cookie when localStorage cannot be read, but not for an account', () => {
    document.cookie = 'makinari-locale=es; path=/';
    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    try {
      expect(readStoredLocale()).toBe('es');
      expect(readStoredLocale('user:account-a')).toBeNull();
    } finally {
      blocked.mockRestore();
    }
  });

  it('updates translations when another tab changes a scoped preference', () => {
    render(<LocalizationProvider preferenceScope="user:account-a"><Probe /></LocalizationProvider>);
    act(() => {
      localStorage.setItem(localeStorageKey('user:account-a'), 'fr');
      window.dispatchEvent(new StorageEvent('storage', { key: localeStorageKey('user:account-a') }));
    });
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(screen.getByTestId('translation')).toHaveTextContent('Commande confirmée');
  });

  it('applies site changes even when an old public preference exists', () => {
    localStorage.setItem('makinari-locale', 'en');
    const tree = (siteLocale: string) => <LocalizationProvider preferenceScope="user:account-a">
      <Probe siteLocale={siteLocale} />
    </LocalizationProvider>;
    const view = render(tree('es'));
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
    view.rerender(tree('fr'));
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
  });

  it('still applies explicit selections when localStorage is blocked', () => {
    const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    try {
      render(<LocalizationProvider preferenceScope="user:account-a"><Probe /></LocalizationProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'Choose German' }));
      expect(screen.getByTestId('locale')).toHaveTextContent('de');
    } finally {
      blocked.mockRestore();
    }
  });
});