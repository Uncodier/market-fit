import "server-only"

import type { createClient } from "@/lib/supabase/server"

export class SiteRoleLookupError extends Error {
  readonly status = 503
  constructor() { super("Site access could not be verified. Please try again.") }
}
const CONNECTION_ERROR_CODES = new Set(["PGRST000", "PGRST001", "PGRST002", "PGRST003"])

function isTransientLookupError(error: unknown, status?: number): boolean {
  if (status === 401 || status === 403) return false
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return true
  if (!error || typeof error !== "object") return false
  const code = String((error as { code?: unknown }).code || "")
  if (CONNECTION_ERROR_CODES.has(code) || code.startsWith("08")) return true
  const message = String((error as { message?: unknown }).message || "").toLowerCase()
  return /fetch failed|failed to fetch|econnreset|etimedout|econnrefused/.test(message)
}

export async function lookupCurrentUserSiteRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
): Promise<string | null> {
  // Only retry an unavailable lookup, never an affirmative permission denial.
  // No data or cache reads are allowed until membership is verified.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let retryable = false
    try {
      const { data: role, error, status } = await supabase.rpc(
        "current_user_site_role", { p_site_id: siteId },
      )
      if (!error) {
        if (role === null || role === "") return null
        if (typeof role === "string") return role
        throw new SiteRoleLookupError()
      }
      retryable = isTransientLookupError(error, status)
    } catch (error) {
      retryable = isTransientLookupError(error)
    }
    if (!retryable || attempt === 1) throw new SiteRoleLookupError()
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new SiteRoleLookupError()
}