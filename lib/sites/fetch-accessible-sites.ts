import {
  isAbortError,
  snapshotPostgrestError,
  type PostgrestErrorSnapshot,
} from "@/lib/supabase/postgrest-error"
import type { Site } from "@/app/context/site-types"

type SitesClient = {
  rpc?: (
    fn: string,
    args?: Record<string, never>
  ) => Promise<{ data: unknown; error: unknown }>
  _isDemo?: boolean
}

type SiteListRow = Site & { focus_mode?: number }
type SiteListDetail = Pick<Site, "id" | "logo_url" | "tracking" | "resource_urls">

export type FetchAccessibleSitesResult = {
  sites: SiteListRow[]
  detail?: SiteListDetail | null
  error: PostgrestErrorSnapshot | null
  aborted: boolean
  unauthorized: boolean
  forbidden?: boolean
  authoritative?: boolean
  revalidateAfterMs?: number
}

function sitesResult(
  partial: Partial<FetchAccessibleSitesResult> & Pick<FetchAccessibleSitesResult, "sites">
): FetchAccessibleSitesResult {
  return {
    error: null,
    aborted: false,
    unauthorized: false,
    authoritative: true,
    ...partial,
  }
}

function isSiteList(value: unknown): value is SiteListRow[] {
  return Array.isArray(value) && value.every(site => site && typeof site === "object" &&
    typeof site.id === "string" && site.id.length > 0)
}

function invalidSitesResult() {
  return sitesResult({ sites: [], error: snapshotPostgrestError(new Error("Invalid sites response")) })
}

export async function fetchAccessibleSitesClient(
  client: SitesClient,
  _detailId?: string | null,
  signal?: AbortSignal,
  fresh = false,
): Promise<FetchAccessibleSitesResult> {
  if (client?._isDemo) {
    if (typeof client.rpc !== "function") {
      return sitesResult({
        sites: [],
        error: snapshotPostgrestError(new Error("Demo client cannot load sites")),
      })
    }

    const { data, error } = await client.rpc("get_my_accessible_sites")
    if (error) {
      return sitesResult({
        sites: isSiteList(data) ? data : [],
        error: snapshotPostgrestError(error),
        aborted: isAbortError(error),
      })
    }
    return isSiteList(data) ? sitesResult({ sites: data }) : invalidSitesResult()
  }

  try {
    const response = await fetch(`/api/sites?view=selector${fresh ? "&fresh=1" : ""}`, { credentials: "include", signal })
    const payload = await response.json().catch(error => {
      if (signal?.aborted || isAbortError(error)) throw error
      return {}
    })
    if (signal?.aborted) return sitesResult({ sites: [], aborted: true })
    if (!response.ok) {
      return sitesResult({
        sites: [],
        error: snapshotPostgrestError(
          payload?.error || new Error(`Failed to load sites (${response.status})`)
        ),
        unauthorized: response.status === 401,
        ...(response.status === 403 ? { forbidden: true } : {}),
      })
    }
    if (!payload || !isSiteList(payload.sites)) return invalidSitesResult()
    return sitesResult({
      sites: payload.sites,
      authoritative: payload.authoritative !== false,
      revalidateAfterMs: typeof payload.revalidateAfterMs === 'number' && Number.isFinite(payload.revalidateAfterMs)
        ? Math.max(0, Math.min(60_000, payload.revalidateAfterMs)) : 0,
      detail: payload.detail
    })
  } catch (error) {
    return sitesResult({
      sites: [],
      error: snapshotPostgrestError(error),
      aborted: signal?.aborted || isAbortError(error),
    })
  }
}
