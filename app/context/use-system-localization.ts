'use client'

import { useSyncExternalStore } from 'react'
import en from './locales/screens/system-en.json'
import es from './locales/screens/system-es.json'
import { normalizeLocale } from './locale-preferences'

const messages: Record<string, Record<string, string>> = { en, es }
const serverLocale = () => 'en'
const currentLocale = () => normalizeLocale(document.documentElement.lang) || 'en'

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  return () => observer.disconnect()
}

/** Error boundaries cannot depend on the providers they may be replacing. */
export function useSystemLocalization() {
  const locale = useSyncExternalStore(subscribe, currentLocale, serverLocale)
  return {
    locale,
    t: (key: string) => messages[locale]?.[key] || (en as Record<string, string>)[key] || key,
  }
}