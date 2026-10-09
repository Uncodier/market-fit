"use client"

import { useCallback, useSyncExternalStore } from "react"

const serverSnapshot = () => false
const maximumTimeout = 2_147_483_647

/** Observe period boundaries outside render, including background-tab recovery. */
export function useCreditPeriodActive(start?: string | null, end?: string | null) {
  const startsAt = Date.parse(start ?? "")
  const endsAt = Date.parse(end ?? "")
  const valid = Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt < endsAt
  const getSnapshot = useCallback(() => {
    const now = Date.now()
    return valid && startsAt <= now && now < endsAt
  }, [valid, startsAt, endsAt])
  const subscribe = useCallback((onChange: () => void) => {
    if (!valid) return () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      onChange()
      const now = Date.now()
      const boundary = now < startsAt ? startsAt : endsAt
      if (boundary > now) timer = setTimeout(refresh, Math.min(boundary - now, maximumTimeout))
    }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [valid, startsAt, endsAt])
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
}