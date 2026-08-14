'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { loadSWRCache, persistSWRCache } from '@/lib/swr/persist-cache';

let persistBound = false;
let activeCache: Map<unknown, unknown> | null = null;

function persistActiveCache() {
  if (activeCache) persistSWRCache(activeCache);
}

function localStorageProvider() {
  const map = loadSWRCache();
  activeCache = map;

  if (typeof window !== 'undefined' && !persistBound) {
    persistBound = true;
    window.addEventListener('pagehide', persistActiveCache);
    window.addEventListener('beforeunload', persistActiveCache);
  }

  return map;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig 
      value={{
        provider: localStorageProvider,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
