import type { Site } from "./site-types"
import { clearCurrentSiteCookie } from "@/lib/auth/current-site-cookie"

export const SITE_SELECTION_CACHE_KEY = "mf_site_selection_v1"
export const SITE_SELECTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Identity hints only. Never persist settings, billing, roles or credentials. */
function identity(site: Site): Site {
  return {
    id: site.id, name: site.name, user_id: site.user_id,
    url: site.url ?? null, description: site.description ?? null,
    logo_url: site.logo_url ?? null, created_at: site.created_at ?? "",
    updated_at: site.updated_at ?? "", resource_urls: null,
  }
}

export function cacheSiteSelection(userId: string | null, site: Site) {
  if (!userId || !UUID.test(site.id)) return
  try {
    localStorage.setItem(SITE_SELECTION_CACHE_KEY, JSON.stringify({
      userId, savedAt: Date.now(), site: identity(site),
    }))
  } catch { /* Optional cache must never prevent selecting a workspace. */ }
}

function readSelectionRecord(userId: string | null): { site: Site; expiresAt: number } | null {
  if (!userId) return null
  try {
    const value = JSON.parse(localStorage.getItem(SITE_SELECTION_CACHE_KEY) || "null")
    const site = value?.site
    if (value?.userId !== userId || !Number.isFinite(value.savedAt) ||
      Date.now() < value.savedAt || Date.now() - value.savedAt > SITE_SELECTION_CACHE_TTL_MS ||
      !site || typeof site.id !== "string" || !UUID.test(site.id) ||
      site.id !== localStorage.getItem("currentSiteId") ||
      typeof site.name !== "string" || typeof site.user_id !== "string") return null
    for (const field of ["url", "description", "logo_url", "created_at", "updated_at"]) {
      if (site[field] != null && typeof site[field] !== "string") return null
    }
    // Re-project on read too: a browser cache is never a trusted Site payload.
    // The final millisecond at the TTL is valid (see the age check above).
    return { site: identity(site), expiresAt: value.savedAt + SITE_SELECTION_CACHE_TTL_MS + 1 }
  } catch { return null }
}

export function readSiteSelection(userId: string | null): Site | null {
  return readSelectionRecord(userId)?.site ?? null
}

/** Text-only UI hint. The caller cannot use this result as an active Site. */
export function readSiteSelectionLabel(userId: string | null, currentSiteId?: string) {
  const hint = readSelectionRecord(userId)
  if (!hint || (currentSiteId && currentSiteId !== hint.site.id)) return null
  const name = hint.site.name.trim()
  return name ? { name, expiresAt: hint.expiresAt } : null
}

export function clearSiteSelectionCache() {
  try { localStorage.removeItem(SITE_SELECTION_CACHE_KEY) } catch { /* Best effort. */ }
}

/** Do not let another actor's saved hint become a fresh selection via the list. */
export function discardForeignSiteSelection(userId: string | null) {
  if (!userId) return
  try {
    const value = JSON.parse(localStorage.getItem(SITE_SELECTION_CACHE_KEY) || "null")
    if (!value || typeof value.userId !== "string" || value.userId === userId) return
    if (value.site?.id === localStorage.getItem("currentSiteId")) {
      localStorage.removeItem("currentSiteId")
      clearCurrentSiteCookie()
    }
    clearSiteSelectionCache()
  } catch { /* Invalid or unavailable storage is not a selection source. */ }
}