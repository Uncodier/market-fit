export const CURRENT_SITE_COOKIE = "mf_current_site_id"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPersistedSiteId(value: string | null | undefined): value is string {
  if (!value) return false
  if (value.startsWith("demo-")) return true
  return UUID_RE.test(value)
}

export function persistCurrentSiteCookie(siteId: string): void {
  if (typeof document === "undefined") return
  if (!isPersistedSiteId(siteId)) return
  document.cookie = `${CURRENT_SITE_COOKIE}=${encodeURIComponent(siteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function clearCurrentSiteCookie(): void {
  if (typeof document === "undefined") return
  document.cookie = `${CURRENT_SITE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function readCurrentSiteIdFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const name = trimmed.slice(0, eq)
    if (name !== CURRENT_SITE_COOKIE) continue
    const raw = decodeURIComponent(trimmed.slice(eq + 1).trim())
    return isPersistedSiteId(raw) ? raw : null
  }
  return null
}
