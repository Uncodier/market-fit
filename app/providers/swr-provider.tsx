'use client';

import React from 'react';
import { SWRConfig, type Cache, type Middleware } from 'swr';
import { loadSWRCache, persistSWRCache } from '@/lib/swr/persist-cache';
import { isTerminalRequestError } from '@/lib/swr/retry-policy';
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

function localStorageProvider() {
  if (!activeCache) {
    activeCache = loadSWRCache();
  }

  if (typeof window !== 'undefined' && !persistBound) {
    persistBound = true;
    window.addEventListener('pagehide', persistActiveCache);
    window.addEventListener('beforeunload', persistActiveCache);
  }

  return activeCache as Cache<unknown>;
}

const optimisticErrorMiddleware: Middleware = (useSWRNext) => {
  return (key, fetcher, config) => {
    const swr = useSWRNext(key, fetcher, config);
    const terminalError = isTerminalRequestError(swr.error);
    const hasData = swr.data !== undefined;
    const [debouncedError, isMaskingError] = useOptimisticError(
      hasData || terminalError ? undefined : swr.error,
      OPTIMISTIC_ERROR_DELAY_MS
    );

    const waitingForRetry = Boolean(swr.error && swr.isValidating && !hasData);
    const isActuallyMasking = !hasData && (isMaskingError || waitingForRetry);

    if (terminalError) return { ...swr, data: undefined, error: swr.error, isLoading: false };
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
        shouldRetryOnError: (error: unknown) => !isTerminalRequestError(error),
        errorRetryCount: OPTIMISTIC_RETRY_COUNT,
        errorRetryInterval: OPTIMISTIC_RETRY_BASE_MS,
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          if (retryCount >= OPTIMISTIC_RETRY_COUNT) return
          if (isTerminalRequestError(error)) return
          if (
            typeof document !== 'undefined' &&
            (document.visibilityState === 'hidden' || !navigator.onLine)
          ) {
            return
          }
          const jitter = 0.75 + Math.random() * 0.5
          setTimeout(
            () => revalidate({ retryCount }),
            Math.round(
              OPTIMISTIC_RETRY_BASE_MS * 2 ** retryCount * jitter
            )
          )
        },
        use: [optimisticErrorMiddleware],
      }}
    >
      {children}
    </SWRConfig>
  );
}
