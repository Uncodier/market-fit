import "server-only"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { configuredApiUrl } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody } from "@/lib/http/read-limited-request-body"
import { catalogSearchRequestSchema, catalogSearchResponseSchema, type CatalogSearchRequest, type CatalogSearchResult } from "./types"
import { publicCatalogClientBucket } from "./public-client-bucket"

export class CatalogSearchError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function transportHeaders(input: CatalogSearchRequest): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
  if (input.channel === "shop" || input.channel === "marketplace") {
    // Only these public channels may use the server credential. No caller headers accepted.
    const key = process.env.SERVICE_API_KEY?.trim()
    if (!key) throw new CatalogSearchError(503, "Catalog search is not configured")
    headers["x-api-key"] = key
    const clientBucket = await publicCatalogClientBucket(key)
    if (clientBucket) headers["x-catalog-client-id"] = clientBucket
    return headers
  }
  const supabase = await createClient(true)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new CatalogSearchError(401, "Please sign in to search the catalog")
  if (!input.site_id || !await getCurrentUserSiteRole(supabase, input.site_id)) {
    throw new CatalogSearchError(403, "You do not have access to this site")
  }
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token || session.user?.id !== user.id) {
    throw new CatalogSearchError(401, "Please sign in again to search the catalog")
  }
  headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

export async function searchCatalog(request: CatalogSearchRequest): Promise<CatalogSearchResult> {
  const parsed = catalogSearchRequestSchema.safeParse(request)
  if (!parsed.success) throw new CatalogSearchError(400, "Invalid catalog search")
  const input = parsed.data
  // Reuse the trusted, server-configured origin policy. This is not a caller fetch target.
  const target = configuredApiUrl(null, "/api/catalog/search")
  if (!target) throw new CatalogSearchError(503, "Catalog search is not configured")
  const headers = await transportHeaders(input)
  try {
    const response = await fetch(target, { method: "POST", headers, body: JSON.stringify(input),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) })
    if (!response.ok) {
      await response.body?.cancel()
      const status = [400, 401, 403, 409, 429].includes(response.status) ? response.status : 502
      throw new CatalogSearchError(status, status === 401 ? "Please sign in again to search the catalog"
        : status === 403 ? "You do not have access to this catalog" : "Catalog search is unavailable")
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      await response.body?.cancel()
      throw new CatalogSearchError(502, "Invalid catalog search response")
    }
    const body = await readLimitedRequestBody(response as unknown as Request, 64_000)
    const result = catalogSearchResponseSchema.safeParse(JSON.parse(decodeRequestBody(body)))
    if (!result.success) throw new CatalogSearchError(502, "Invalid catalog search response")
    const data = result.data
    if (input.search_id && data.search_id !== input.search_id) {
      throw new CatalogSearchError(409, "Catalog search expired. Please start again.")
    }
    const ids = new Set(data.items.map(item => item.id))
    if (ids.size !== data.items.length ||
      data.items.length !== Math.min(input.limit, Math.max(0, data.count - input.offset)) ||
      data.has_more !== (input.offset + data.items.length < data.count) ||
      data.items.some(item => input.site_id && item.site_id !== input.site_id)) {
      throw new CatalogSearchError(502, "Invalid catalog search response")
    }
    return { ...data, result_kind: data.result_kind ?? "matched" }
  } catch (error) {
    if (error instanceof CatalogSearchError) throw error
    throw new CatalogSearchError(502, "Catalog search is unavailable")
  }
}

/** At most two bounded requests; a changing window fails visibly rather than mixing rankings. */
export async function searchCatalogWindow(request: Omit<CatalogSearchRequest, "limit" | "offset">): Promise<CatalogSearchResult> {
  const first = await searchCatalog({ ...request, limit: 100, offset: 0 })
  if (!first.has_more) return first
  const second = await searchCatalog({ ...request, limit: 100, offset: 100, search_id: first.search_id })
  const items = [...first.items, ...second.items]
  if (second.search_id !== first.search_id || second.mode !== first.mode || second.result_kind !== first.result_kind || second.count !== first.count ||
    (second.candidate_window_truncated === true) !== (first.candidate_window_truncated === true) ||
    new Set(items.map(item => item.id)).size !== items.length) {
    throw new CatalogSearchError(409, "Catalog search changed. Please try again.")
  }
  return { ...first, items, has_more: false, degraded: first.degraded || second.degraded }
}