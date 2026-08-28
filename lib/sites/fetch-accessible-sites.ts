import {
  isAbortError,
  snapshotPostgrestError,
  type PostgrestErrorSnapshot,
} from "@/lib/supabase/postgrest-error"

type SitesClient = {
  rpc?: (
    fn: string,
    args?: Record<string, never>
  ) => Promise<{ data: unknown; error: unknown }>
  _isDemo?: boolean
}

export type FetchAccessibleSitesResult = {
  sites: any[]
  detail?: any
  error: PostgrestErrorSnapshot | null
  aborted: boolean
  unauthorized: boolean
}

function sitesResult(
  partial: Partial<FetchAccessibleSitesResult> & { sites: any[] }
): FetchAccessibleSitesResult {
  return {
    error: null,
    aborted: false,
    unauthorized: false,
    ...partial,
  }
}

export async function fetchAccessibleSitesClient(
  client: SitesClient,
  detailId?: string | null
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
        sites: Array.isArray(data) ? data : [],
        error: snapshotPostgrestError(error),
        aborted: isAbortError(error),
      })
    }
    return sitesResult({ sites: Array.isArray(data) ? data : [] })
  }

  try {
    const url = detailId ? `/api/sites?detail=${detailId}` : "/api/sites"
    const response = await fetch(url, { credentials: "include" })
    const payload = await response.json().catch(() => ({} as { error?: unknown; sites?: unknown; detail?: unknown }))
    if (!response.ok) {
      return sitesResult({
        sites: [],
        error: snapshotPostgrestError(
          payload.error || new Error(`Failed to load sites (${response.status})`)
        ),
        unauthorized: response.status === 401,
      })
    }
    return sitesResult({
      sites: Array.isArray(payload.sites) ? payload.sites : [],
      detail: payload.detail
    })
  } catch (error) {
    return sitesResult({
      sites: [],
      error: snapshotPostgrestError(error),
      aborted: isAbortError(error),
    })
  }
}
