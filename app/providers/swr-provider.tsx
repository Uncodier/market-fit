'use client';

import React from 'react';
import { SWRConfig, Middleware } from 'swr';
import { loadSWRCache, persistSWRCache } from '@/lib/swr/persist-cache';
import {
  OPTIMISTIC_ERROR_DELAY_MS,
  OPTIMISTIC_RETRY_COUNT,
  OPTIMISTIC_RETRY_BASE_MS,
  useOptimisticError,
} from '@/app/hooks/use-optimistic-error';

let persistBound = false;
let activeCache: Map<unknown, unknown> | null = null;

function persistActiveCache() {
  if (activeCache) persistSWRCache(activeCache);
}

function localStorageProvider(): any {
  if (!activeCache) {
    activeCache = loadSWRCache();
  }

  if (typeof window !== 'undefined' && !persistBound) {
    persistBound = true;
    window.addEventListener('pagehide', persistActiveCache);
    window.addEventListener('beforeunload', persistActiveCache);
  }

  return activeCache;
}

const optimisticErrorMiddleware: Middleware = (useSWRNext) => {
  return (key, fetcher, config) => {
    const swr = useSWRNext(key, fetcher, config);
    const hasData = swr.data !== undefined;
    const [debouncedError, isMaskingError] = useOptimisticError(
      hasData ? undefined : swr.error,
      OPTIMISTIC_ERROR_DELAY_MS
    );

    const waitingForRetry = Boolean(swr.error && swr.isValidating && !hasData);
    const isActuallyMasking = !hasData && (isMaskingError || waitingForRetry);

    return {
      ...swr,
      error: isActuallyMasking || hasData ? undefined : debouncedError,
      isLoading: swr.isLoading || isActuallyMasking,
    };
  };
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig 
      value={{
        provider: localStorageProvider,
        keepPreviousData: true,
        shouldRetryOnError: true,
        errorRetryCount: OPTIMISTIC_RETRY_COUNT,
        errorRetryInterval: OPTIMISTIC_RETRY_BASE_MS,
        onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
          if (retryCount >= OPTIMISTIC_RETRY_COUNT) return
          setTimeout(
            () => revalidate({ retryCount }),
            OPTIMISTIC_RETRY_BASE_MS * (retryCount + 1)
          )
        },
        use: [optimisticErrorMiddleware],
      }}
    >
      {children}
    </SWRConfig>
  );
}
