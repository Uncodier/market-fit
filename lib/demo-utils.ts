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

export function isDemoSiteId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("demo-")
}

/** Owned workspace sites only — demos and the placeholder `default` id do not count. */
export function isRealSiteId(id: string | null | undefined): boolean {
  if (!id || id === "default") return false
  return !isDemoSiteId(id)
}

/** True when the browser still has demo cookie or manual-demo flag. */
export function isDemoModeActive(): boolean {
  if (typeof document === "undefined") return false
  try {
    const match = document.cookie.match(/(?:^|; )market_fit_demo_site_id=([^;]*)/)
    const cookieId = match?.[1] ? decodeURIComponent(match[1]).trim() : ""
    if (isDemoSiteId(cookieId)) return true
    if (localStorage.getItem("market_fit_manual_demo") === "true") return true
    return isDemoSiteId(localStorage.getItem("currentSiteId"))
  } catch {
    return false
  }
}
