'use client';

import { useEffect, type ReactNode } from 'react';
import useSWR from 'swr';
import { useAuthContext } from '@/app/components/auth/auth-context';
import { LocalizationProvider } from '@/app/context/LocalizationContext';
import { localeStorageKey, normalizeLocale, profileLocaleKey } from '@/app/context/locale-preferences';
import { createClient } from '@/lib/supabase/client';

export function AccountLocalizationProvider({ children, workspace }: {
  children: ReactNode;
  workspace: boolean;
}) {
  const { user, isLoading } = useAuthContext();
  const userId = workspace && !isLoading ? user?.id : undefined;
  const { data: preferredLocale, mutate } = useSWR(
    userId ? profileLocaleKey(userId) : null,
    async ([, id]: [string, string]) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        // This browser client carries the session and RLS limits the profile read.
        const { data, error } = await createClient()
          .from('profiles')
          .select('language')
          .eq('id', id)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (error) throw new Error('Unable to load language preference');
        return normalizeLocale(data?.language);
      } finally {
        window.clearTimeout(timeout);
      }
    },
    { keepPreviousData: false },
  );
  const scope = userId ? `user:${userId}` : workspace && isLoading ? 'workspace:pending' : null;

  useEffect(() => {
    if (!userId) return;
    const refreshPreference = (event: StorageEvent) => {
      if (event.key === localeStorageKey(`user:${userId}`) || event.key === null) {
        void mutate();
      }
    };
    window.addEventListener('storage', refreshPreference);
    return () => window.removeEventListener('storage', refreshPreference);
  }, [userId, mutate]);

  return (
    <LocalizationProvider preferenceScope={scope} preferredLocale={userId ? preferredLocale : null}>
      {children}
    </LocalizationProvider>
  );
}