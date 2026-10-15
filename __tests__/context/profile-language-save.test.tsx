import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig, useSWRConfig } from 'swr';
import { useProfile } from '@/app/hooks/use-profile';
import { profileService, type ProfileData } from '@/app/services/profile.service';
import { LocalizationProvider, useLocalization } from '@/app/context/LocalizationContext';
import { profileLocaleKey, readStoredLocale } from '@/app/context/locale-preferences';

let mockUserId = 'account-a';
jest.mock('@/app/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: mockUserId }, isAuthenticated: true }),
}));
jest.mock('@/app/services/profile.service', () => ({
  profileService: { getProfile: jest.fn(), upsertProfile: jest.fn() },
}));
jest.mock('@/lib/services/email-change.service', () => ({
  getEmailChangeStatus: jest.fn(async () => ({ pendingEmail: null, isPending: false, currentEmail: null })),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const profile: ProfileData = {
  id: 'account-a', email: 'example@example.com', language: 'en',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>
    <LocalizationProvider preferenceScope={`user:${mockUserId}`}>{children}</LocalizationProvider>
  </SWRConfig>;
}

function useProbe() {
  return { ...useProfile(), ...useLocalization(), ...useSWRConfig() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'account-a';
  localStorage.clear();
  document.cookie = 'makinari-locale=; Max-Age=0; path=/';
  jest.mocked(profileService.getProfile).mockResolvedValue(profile);
});

it('applies a confirmed language save and updates the account bootstrap cache', async () => {
  jest.mocked(profileService.upsertProfile).mockResolvedValue({ ...profile, language: 'es-MX' });
  const { result } = renderHook(useProbe, { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => {
    expect(await result.current.updateProfile({ language: 'es' }, true)).toBe(true);
  });
  expect(result.current.locale).toBe('es');
  expect(result.current.t('checkout.success.title')).toBe('Pedido confirmado');
  expect(readStoredLocale('user:account-a')).toBe('es');
  expect(readStoredLocale()).toBeNull();
  // SWR serializes the identity-scoped tuple, so inspect through its public cache API.
  const { unstable_serialize } = await import('swr');
  expect(result.current.cache.get(unstable_serialize(profileLocaleKey('account-a')))?.data).toBe('es');
});

it('does not change the locale or browser preference when persistence fails', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(profileService.upsertProfile).mockRejectedValue(new Error('Unable to save profile'));
  try {
    const { result } = renderHook(useProbe, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.updateProfile({ language: 'es' }, true)).toBe('Unable to save profile');
    });
    expect(result.current.locale).toBe('en');
    expect(readStoredLocale('user:account-a')).toBeNull();
  } finally {
    errorLog.mockRestore();
  }
});

it('does not override a manual choice when saving an unrelated profile field', async () => {
  jest.mocked(profileService.upsertProfile).mockResolvedValue({ ...profile, name: 'Updated' });
  const { result } = renderHook(useProbe, { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.setLocale('fr'));
  await act(async () => {
    expect(await result.current.updateProfile({ name: 'Updated' }, true)).toBe(true);
  });
  expect(result.current.locale).toBe('fr');
});

it('does not apply a late save to the next account or discard its manual choice', async () => {
  let finishSave!: (profile: ProfileData) => void;
  jest.mocked(profileService.upsertProfile).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
  const { result, rerender } = renderHook(useProbe, { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let pendingSave!: Promise<boolean | string>;
  act(() => { pendingSave = result.current.updateProfile({ language: 'es' }, true); });
  mockUserId = 'account-b';
  jest.mocked(profileService.getProfile).mockResolvedValue({ ...profile, id: 'account-b', language: 'ja' });
  rerender();
  await waitFor(() => expect(result.current.profile?.id).toBe('account-b'));
  act(() => result.current.setLocale('de'));
  await act(async () => {
    finishSave({ ...profile, language: 'es' });
    await pendingSave;
  });
  expect(result.current.locale).toBe('de');
  expect(result.current.profile?.id).toBe('account-b');
  expect(readStoredLocale('user:account-b')).toBe('de');
});

it('does not restore the previous account profile when its read finishes late', async () => {
  let finishRead!: (profile: ProfileData) => void;
  jest.mocked(profileService.getProfile).mockReturnValueOnce(new Promise(resolve => { finishRead = resolve; }));
  const { result, rerender } = renderHook(useProbe, { wrapper });
  mockUserId = 'account-b';
  jest.mocked(profileService.getProfile).mockResolvedValue({ ...profile, id: 'account-b', language: 'ja' });
  rerender();
  await waitFor(() => expect(result.current.profile?.id).toBe('account-b'));
  await act(async () => { finishRead(profile); });
  expect(result.current.profile?.id).toBe('account-b');
  expect(result.current.profile?.language).toBe('ja');
});