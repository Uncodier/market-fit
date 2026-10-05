"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-cookies"

const IDLE_THRESHOLD_MS = 2 * 60 * 1000
const REFRESH_WINDOW_SECONDS = 120
const WAKE_COALESCE_MS = 1500
const SESSION_OBSERVATION_MS = 5000

// A timeout cannot cancel SDK work. Retain the flight until it actually settles,
// including across unmounts, so another wake cannot race a token refresh.
let sessionOperation: Promise<void> | null = null

async function ensureFreshSession(canContinue: () => boolean): Promise<void> {
  let supabase: ReturnType<typeof createClient> | undefined
  try {
    supabase = createClient()
    const { data, error } = await supabase.auth.getSession()
    if (!canContinue()) return
    if (error) throw error
    const session = data?.session

    // Missing sessions are handled by existing auth boundaries, not navigation
    // from a wake handler that could interrupt an in-page interaction.
    if (!session) return

    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresAt = session.expires_at ?? 0
    const secondsToExpiry = expiresAt - nowSeconds

    if (secondsToExpiry <= REFRESH_WINDOW_SECONDS) {
      const { error } = await supabase.auth.refreshSession()
      if (error) throw error
    }
  } catch (err) {
    if (canContinue() && supabase && isInvalidRefreshTokenError(err)) {
      try {
        await supabase.auth.signOut({ scope: "local" })
      } catch {
        // Local cleanup is best effort; transient failures must not log out.
      }
    }
  }
}

/**
 * Refresh near-expiry auth after idle without touching routing or modal styles.
 * Wake observation is bounded; normal navigation remains entirely SPA-driven.
 */
export function useWakeSessionRefresh(): void {
  useEffect(() => {
    let lastActiveAt = Date.now()
    let hiddenAt: number | null = document.visibilityState === "hidden" ? lastActiveAt : null
    let nextWakeAt = 0
    let stopObserving: (() => void) | undefined

    const handleWake = (forceIdle = false) => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      const idleMs = now - Math.min(lastActiveAt, hiddenAt ?? lastActiveAt)
      lastActiveAt = now
      hiddenAt = null

      if (!forceIdle && idleMs <= IDLE_THRESHOLD_MS) return
      if (!navigator.onLine || now < nextWakeAt) return
      nextWakeAt = now + WAKE_COALESCE_MS
      if (sessionOperation) return

      let observing = true
      const deadline = now + SESSION_OBSERVATION_MS
      const canContinue = () => observing && Date.now() < deadline && navigator.onLine
      const stop = () => {
        observing = false
        window.clearTimeout(timer)
      }
      const timer = window.setTimeout(stop, SESSION_OBSERVATION_MS)
      stopObserving = stop
      sessionOperation = ensureFreshSession(canContinue).finally(() => {
        sessionOperation = null
        stop()
        if (stopObserving === stop) stopObserving = undefined
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt ??= Date.now()
      } else {
        handleWake()
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) handleWake(true)
    }

    // Check idle before recording activity: pointerdown can precede focus or
    // visibilitychange when returning to a hidden tab.
    const handleActivity = () => handleWake()
    const handleOnline = () => handleWake(true)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleActivity)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("online", handleOnline)
    window.addEventListener("pointerdown", handleActivity, { passive: true })
    window.addEventListener("keydown", handleActivity, { passive: true })
    return () => {
      stopObserving?.()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleActivity)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("pointerdown", handleActivity)
      window.removeEventListener("keydown", handleActivity)
    }
  }, [])
}
