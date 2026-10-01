import type { Locale } from "date-fns"
import { isDateRangePreset, resolveDateRangePreset, type DateRangeSelection } from "./date-range-presets"

export type CachedDateRange = {
  startDate: Date
  endDate: Date
  preset?: DateRangeSelection
}

export function readDateRange(
  storageKey: string, locale?: Locale, now = new Date(),
): CachedDateRange | null | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return undefined
    const stored: unknown = JSON.parse(raw)
    if (stored === null) return null
    if (typeof stored !== "object" || Array.isArray(stored)) return undefined
    if (!("startDate" in stored) || !("endDate" in stored)) return undefined
    if (typeof stored.startDate !== "string" || typeof stored.endDate !== "string") return undefined

    const startDate = new Date(stored.startDate)
    const endDate = new Date(stored.endDate)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return undefined
    }

    const preset = "preset" in stored ? stored.preset : undefined
    if (isDateRangePreset(preset)) {
      return { ...resolveDateRangePreset(preset, now, locale), preset }
    }
    // Legacy dates and unknown presets are fixed ranges; never infer user intent from dates.
    return { startDate, endDate, preset: "custom" }
  } catch {
    return undefined
  }
}

export function cacheDateRange(storageKey: string, range: CachedDateRange | null) {
  if (typeof window === "undefined") return
  try {
    const stored = range ? {
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      preset: range.preset ?? "custom",
    } : null
    window.localStorage.setItem(storageKey, JSON.stringify(stored))
  } catch (error) {
    console.warn("Failed to cache the date range:", error)
  }
}