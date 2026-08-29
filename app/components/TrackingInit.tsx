"use client"

import { useEffect } from "react"

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
    MarketFit?: { init?: (opts: Record<string, unknown>) => void }
  }
  if (w.MarketFit?.init) return

  w.MarketFit = w.MarketFit || {}
  w.MarketFit.siteId = "9be0a6a2-5567-41bf-ad06-cb4014f0faf2"

  const script = document.createElement("script")
  script.async = true
  script.src = "https://files.uncodie.com/tracking.min.js"
  script.onload = () => {
    try {
      if (typeof w.MarketFit?.init !== "function") return
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark")
      w.MarketFit.init({
        siteId: "9be0a6a2-5567-41bf-ad06-cb4014f0faf2",
        trackVisitors: true,
        trackActions: true,
        recordScreen,
        debug: false,
        theme: isDark ? "dark" : "default",
        chat: {
          enabled: true,
          hidden: true,
          allowAnonymousMessages: false,
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
