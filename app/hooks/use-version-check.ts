"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { shouldCheckVersion } from "./version-check-policy"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const CHECK_TIMEOUT_MS = 10_000
const TOAST_ID = "app-version-update"
const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
const STORAGE_KEY = "mf:version-check:last"

function resolveVersionUrl(): string {
  const isWww =
    typeof window !== "undefined" && window.location.hostname === "www.makinari.com"
  return isWww ? "https://app.makinari.com/api/version" : "/api/version"
}

async function fetchServerBuildId(controller: AbortController): Promise<string | null> {
  const { signal } = controller
  let onAbort = () => {}
  const cancelled = new Promise<null>((resolve) => {
    onAbort = () => resolve(null)
    signal.addEventListener("abort", onAbort, { once: true })
  })
  const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  try {
    // Bound both headers and body reads, even if a transport ignores abort.
    return await Promise.race([cancelled, (async () => {
      const response = await fetch(resolveVersionUrl(), { cache: "no-cache", signal })
      if (signal.aborted) return null
      if (response.status === 304) return CLIENT_BUILD_ID || null
      if (!response.ok) return null
      const data = (await response.json()) as { version?: unknown }
      return typeof data.version === "string" && data.version ? data.version : null
    })()])
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener("abort", onAbort)
  }
}

export function useVersionCheck(): void {
  const hasNotifiedRef = useRef(false)
  const { t } = useLocalization()
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return
    if (!CLIENT_BUILD_ID) return

    let disposed = false
    let checking = false
    let activeRequest: AbortController | null = null
    let lastLocalCheck: number | null = null

    const requestUpdate = (event: { preventDefault: () => void }) => {
      // Keep the update available after deferral or a cancelled confirmation.
      event.preventDefault()
      if (disposed) return
      const pathname = window.location.pathname
      if (pathname === "/pos" || pathname.startsWith("/pos/")) {
        // The global hook cannot observe debounced cart saves, payment dialogs,
        // or register mutations. An empty persisted cart is not proof of safety.
        toast.warning("Update deferred while POS is open", {
          id: "app-version-update-deferred",
          description: "Finish and sync your POS work, resolve any queued or unconfirmed payments, then leave POS before updating. Nothing has been reloaded.",
        })
        return
      }
      if (!navigator.onLine) {
        toast.warning("Update deferred while offline", {
          id: "app-version-update-deferred",
          description: "Reconnect before updating. Nothing has been reloaded.",
        })
        return
      }
      if (window.confirm("Reload to update? Unsaved changes may be lost. Continue only after saving your work and confirming that POS orders and payments have finished syncing.")) {
        window.location.reload()
      }
    }

    const notifyIfStale = async () => {
      if (disposed || checking || hasNotifiedRef.current) return
      
      const now = Date.now()
      let lastCheck = lastLocalCheck
      try {
        const stored = Number(localStorage.getItem(STORAGE_KEY))
        if (Number.isFinite(stored)) lastCheck = Math.max(lastCheck ?? 0, stored)
      } catch {
        // Storage availability must not break an advisory version check.
      }
      
      const visible = document.visibilityState === "visible"
      
      if (!shouldCheckVersion({ now, lastCheck, visible })) return
      
      lastLocalCheck = now
      try { localStorage.setItem(STORAGE_KEY, now.toString()) } catch { /* Use the in-memory throttle. */ }

      checking = true
      activeRequest = new AbortController()
      const serverBuildId = await fetchServerBuildId(activeRequest)
      activeRequest = null
      checking = false
      if (disposed || !serverBuildId || serverBuildId === CLIENT_BUILD_ID) return

      hasNotifiedRef.current = true
      toast.info(tRef.current("version.newAvailable"), {
        id: TOAST_ID,
        description: "Keep working; this notice will not reload the page automatically. Save your work and finish syncing before updating. Updates are deferred while POS is open.",
        duration: Infinity,
        action: {
          label: tRef.current("version.reload"),
          onClick: requestUpdate,
        },
      })
    }

    void notifyIfStale()

    const intervalId = window.setInterval(() => {
      void notifyIfStale()
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void notifyIfStale()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      disposed = true
      activeRequest?.abort()
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      toast.dismiss(TOAST_ID)
      toast.dismiss("app-version-update-deferred")
      hasNotifiedRef.current = false
    }
  }, [])
}
