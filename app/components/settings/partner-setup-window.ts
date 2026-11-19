export function getPartnerSetupUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

export function closePartnerSetupWindow(popup: Window | null): void {
  try { popup?.close() } catch { /* A closed setup tab must not fail the request. */ }
}

export function reservePartnerSetupWindow(): Window | null {
  let popup: Window | null = null
  try {
    // Reserve during the user gesture, before auth or invitation requests await.
    popup = window.open("about:blank", "_blank") || null
    if (popup) popup.opener = null
    return popup
  } catch {
    closePartnerSetupWindow(popup)
    return null
  }
}

export function navigatePartnerSetupWindow(popup: Window | null, value: unknown): boolean {
  const url = getPartnerSetupUrl(value)
  try {
    if (popup && !popup.closed && url) {
      popup.location.replace(url)
      return true
    }
  } catch { /* Preserve the native Continue Setup link if navigation is blocked. */ }
  closePartnerSetupWindow(popup)
  return false
}