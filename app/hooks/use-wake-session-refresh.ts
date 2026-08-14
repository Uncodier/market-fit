"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-cookies"
import { markClientRouterStale } from "@/lib/navigation/stale-router"

const IDLE_THRESHOLD_MS = 2 * 60 * 1000
const REFRESH_WINDOW_SECONDS = 120
const WAKE_COALESCE_MS = 1500

function clearStuckPointerEvents(): void {
  document.body.style.pointerEvents = ""
  document.documentElement.style.pointerEvents = ""
}

async function ensureFreshSession(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const session = data?.session

    if (!session) {
      // No local session at all. Don't force-navigate here — middleware
      // will redirect the next request. Forcing window.location now would
      // interrupt a user that is actively typing/clicking in-page.
      return false
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresAt = session.expires_at ?? 0
    const secondsToExpiry = expiresAt - nowSeconds

    if (secondsToExpiry <= REFRESH_WINDOW_SECONDS) {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {})
        }
        return false
      }
      return true
    }
    return false
  } catch (err) {
    console.warn("[wake-session] Session refresh on wake failed:", err)
    if (isInvalidRefreshTokenError(err)) {
      try {
        await createClient().auth.signOut({ scope: "local" })
      } catch {
        // ignore
      }
    }
    return false
  }
}

/**
 * After long idle, refresh auth cookies and mark the App Router stale so the
 * next menu click can hard-navigate. Do not call router.refresh() — a pending
 * RSC transition can deadlock subsequent router.push() calls.
 */
export function useWakeSessionRefresh(): void {
  const lastActiveAtRef = useRef(Date.now())
  const isRefreshingAfterIdleRef = useRef(false)
  const wakeHandledRef = useRef(false)

  useEffect(() => {
    const touchActive = () => {
      lastActiveAtRef.current = Date.now()
    }

    const handleWake = async (forceIdle = false) => {
      clearStuckPointerEvents()

      const idleMs = Date.now() - lastActiveAtRef.current
      const isIdle = forceIdle || idleMs > IDLE_THRESHOLD_MS
      touchActive()

      if (!isIdle) return
      if (wakeHandledRef.current) return
      wakeHandledRef.current = true

      try {
        markClientRouterStale()
        if (isRefreshingAfterIdleRef.current) return
        isRefreshingAfterIdleRef.current = true
        try {
          await ensureFreshSession()
        } finally {
          isRefreshingAfterIdleRef.current = false
        }
      } finally {
        window.setTimeout(() => {
          wakeHandledRef.current = false
        }, WAKE_COALESCE_MS)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void handleWake()
      }
    }

    const handleWindowFocus = () => {
      if (document.visibilityState !== "visible") return
      void handleWake()
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      void handleWake(true)
    }

    const handleUserActivity = () => {
      if (document.visibilityState !== "visible") return
      touchActive()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleWindowFocus)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("pointerdown", handleUserActivity, { passive: true })
    window.addEventListener("keydown", handleUserActivity, { passive: true })
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleWindowFocus)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("pointerdown", handleUserActivity)
      window.removeEventListener("keydown", handleUserActivity)
    }
  }, [])
}
