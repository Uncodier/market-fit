export const PARTNER_SETUP_WINDOW_FEATURES = "popup=yes,width=960,height=760,resizable=yes,scrollbars=yes"

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
    popup = window.open("about:blank", "_blank", PARTNER_SETUP_WINDOW_FEATURES) || null
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

type PartnerSetupClick = Pick<MouseEvent, "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "preventDefault"> & {
  currentTarget: Pick<HTMLAnchorElement, "href">
}

export function openPartnerSetupFromClick(event: PartnerSetupClick): boolean | undefined {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  // Prevent native navigation even when opening is blocked; never replace Settings.
  event.preventDefault()
  const url = getPartnerSetupUrl(event.currentTarget.href)
  if (!url) return false
  return navigatePartnerSetupWindow(reservePartnerSetupWindow(), url)
}