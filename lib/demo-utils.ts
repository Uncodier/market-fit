/**
 * Clear demo-mode cookie + local flags.
 * Safe to call multiple times; does not navigate or reload.
 */
export function exitDemoMode() {
  if (typeof document === "undefined") return

  const name = "market_fit_demo_site_id"
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT"
  const base = `${name}=; path=/; expires=${expires}; max-age=0`

  document.cookie = base

  try {
    const host = window.location.hostname
    if (host && host.includes(".")) {
      document.cookie = `${base}; domain=${host}`
      const parts = host.split(".")
      if (parts.length >= 2) {
        const parent = `.${parts.slice(-2).join(".")}`
        document.cookie = `${base}; domain=${parent}`
      }
    }
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem("market_fit_manual_demo")

    const currentSite = localStorage.getItem("currentSiteId")
    if (currentSite && currentSite.startsWith("demo-")) {
      localStorage.removeItem("currentSiteId")
    }
  } catch {
    // ignore
  }
}

/** True when the browser still has demo cookie or manual-demo flag. */
export function isDemoModeActive(): boolean {
  if (typeof document === "undefined") return false
  try {
    if (document.cookie.includes("market_fit_demo_site_id=")) return true
    if (localStorage.getItem("market_fit_manual_demo") === "true") return true
    const currentSite = localStorage.getItem("currentSiteId")
    return !!currentSite && currentSite.startsWith("demo-")
  } catch {
    return false
  }
}
