'use client';

import React from 'react';
import { SWRConfig } from 'swr';

function localStorageProvider() {
  if (typeof window === 'undefined') return new Map()
  
  // Try to load cache from localStorage
  let map: Map<any, any>;
  try {
    const savedCache = localStorage.getItem('swr-cache');
    map = new Map(savedCache ? JSON.parse(savedCache) : []);
  } catch (e) {
    console.error("Could not load SWR cache from localStorage", e);
    map = new Map();
  }

  // Save cache to localStorage before unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      try {
        // Filter out keys that hold large amounts of data to prevent QuotaExceededError (5MB limit)
        const entriesToSave = Array.from(map.entries()).filter(([key]) => {
          if (typeof key !== 'string') return true;
          if (key.includes('chat-messages')) return false;
          if (key.includes('imprenta-data')) return false;
          if (key.includes('instance-logs')) return false;
          return true;
        });
        const appCache = JSON.stringify(entriesToSave);
        localStorage.setItem('swr-cache', appCache);
      } catch (e) {
        console.error("Could not save SWR cache to localStorage (possibly exceeded quota)", e);
      }
    });
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
