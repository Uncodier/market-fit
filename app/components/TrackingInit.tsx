"use client"

import { useEffect } from "react"
import { SUPPORT_SITE_ID } from "@/lib/chat/identity-types"

const PUBLIC_RECORD_SCREEN_OFF = [
  "/shop",
  "/marketplace",
  "/cart",
  "/book",
  "/buyer",
  "/q/",
  "/i/",
  "/so/",
  "/vb/",
]

function shouldRecordScreen(pathname: string): boolean {
  return !PUBLIC_RECORD_SCREEN_OFF.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  )
}

function loadTracking(recordScreen: boolean) {
  if (typeof window === "undefined") return
  const w = window as Window & {
    Makinari?: { siteId?: string; init?: (opts: Record<string, unknown>) => void }
    MarketFit?: { siteId?: string; init?: (opts: Record<string, unknown>) => void }
  }
  if (w.Makinari?.init || w.MarketFit?.init) return

  w.Makinari = w.Makinari || w.MarketFit || {}
  w.MarketFit = w.Makinari
  w.Makinari.siteId = SUPPORT_SITE_ID

  const script = document.createElement("script")
  script.async = true
  script.src = "https://files.uncodie.com/tracking.min.js?v=1.965"
  script.onload = () => {
    try {
      if (typeof w.Makinari?.init !== "function") return
      w.Makinari.init({
        siteId: SUPPORT_SITE_ID,
        trackVisitors: true,
        trackActions: true,
        recordScreen,
        consentRequired: false,
        debug: false,
        chat: {
          enabled: true,
          hidden: true,
          allowAnonymousMessages: false,
          requireIdentityToken: true,
          position: "bottom-right",
          title: "Customer and Tech Support",
          welcomeMessage: "Welcome to Market Fit! How can we assist you today?",
        },
      })
    } catch {
      // Tracking must never block the app
    }
  }
  document.head.appendChild(script)
}

export default function TrackingInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return

    const recordScreen = shouldRecordScreen(window.location.pathname)
    const run = () => loadTracking(recordScreen)

    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback

    if (typeof idle === "function") {
      idle(run, { timeout: 2500 })
      return
    }

    window.setTimeout(run, 1500)
  }, [])

  return null
}
