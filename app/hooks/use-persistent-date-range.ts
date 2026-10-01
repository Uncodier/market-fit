"use client"

import { useMemo, useSyncExternalStore } from "react"
import { addDays, startOfDay, type Locale } from "date-fns"
import { enUS } from "date-fns/locale"
import { cacheDateRange, readDateRange, type CachedDateRange } from "@/lib/dates/date-range-cache"
import { isDateRangePreset, resolveDateRangePreset, type DateRangePreset } from "@/lib/dates/date-range-presets"

type Snapshot = { dateRange: CachedDateRange | null; isDateRangeReady: boolean }
const EMPTY_SNAPSHOT: Snapshot = { dateRange: null, isDateRangeReady: false }
const getServerSnapshot = () => EMPTY_SNAPSHOT

function createDateRangeStore(storageKey: string | null, locale: Locale, defaultPreset: DateRangePreset) {
  let snapshot = EMPTY_SNAPSHOT
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const publish = (dateRange: CachedDateRange | null) => {
    snapshot = { dateRange, isDateRangeReady: true }
    listeners.forEach((notify) => notify())
  }
  const refresh = () => {
    clearTimeout(timer)
    const range = snapshot.dateRange
    const preset = range?.preset
    if (!storageKey || !range || !isDateRangePreset(preset)) return
    const now = new Date()
    const next = { ...resolveDateRangePreset(preset, now, locale), preset }
    if (range.startDate.getTime() !== next.startDate.getTime() || range.endDate.getTime() !== next.endDate.getTime()) {
      cacheDateRange(storageKey, next)
      publish(next)
    }
    // Calendar arithmetic keeps the next refresh at local midnight across DST changes.
    timer = setTimeout(refresh, startOfDay(addDays(now, 1)).getTime() - now.getTime())
  }
  const onVisible = () => { if (document.visibilityState === "visible") refresh() }

  return {
    getSnapshot: () => snapshot,
    setDateRange: (range: CachedDateRange | null) => {
      if (!storageKey || !snapshot.isDateRangeReady) return
      cacheDateRange(storageKey, range)
      publish(range)
      refresh()
    },
    subscribe: (notify: () => void) => {
      if (!storageKey) return () => {}
      listeners.add(notify)
      if (listeners.size === 1) {
        // Read browser storage after hydration, before allowing a data request for this key.
        const cached = readDateRange(storageKey, locale)
        publish(cached === undefined
          ? { ...resolveDateRangePreset(defaultPreset, new Date(), locale), preset: defaultPreset }
          : cached)
        refresh()
        window.addEventListener("focus", refresh)
        document.addEventListener("visibilitychange", onVisible)
      }
      return () => {
        listeners.delete(notify)
        if (listeners.size === 0) {
          clearTimeout(timer)
          window.removeEventListener("focus", refresh)
          document.removeEventListener("visibilitychange", onVisible)
        }
      }
    },
  }
}

export function usePersistentDateRange(
  storageKey: string | null, locale: Locale = enUS, defaultPreset: DateRangePreset = "last30Days",
) {
  const store = useMemo(() => createDateRangeStore(storageKey, locale, defaultPreset), [storageKey, locale, defaultPreset])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot)
  return { ...snapshot, setDateRange: store.setDateRange }
}