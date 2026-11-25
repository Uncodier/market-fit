export type SiteRow = {
  id: string
  [key: string]: unknown
}

type QueryResponse = {
  data: unknown[] | null
  error: { message?: string } | null
  count: number | null
}

export interface SitesQuery extends PromiseLike<QueryResponse> {
  eq(column: string, value: string | boolean): this
  is(column: string, value: null): this
  in(column: string, values: string[]): this
  order(column: string, options: { ascending: boolean }): this
  range(from: number, to: number): this
  abortSignal(signal: AbortSignal): this
}

export type SitesAdminClient = {
  from(table: string): {
    select(columns: string, options: { count: "exact" }): unknown
  }
  rpc(
    name: "list_effective_selector_memberships",
    args: { p_user_id: string },
    options: { get: true; count: "exact" },
  ): { select(columns: string): unknown }
}

const PAGE_SIZE = 500
const MAX_PAGES = 20
const ID_BATCH_SIZE = 100
const ID_BATCH_CONCURRENCY = 3

function select(admin: SitesAdminClient, table: string, columns: string): SitesQuery {
  // Keep Supabase's recursive select-result types at this boundary; structurally
  // comparing the full builder exceeds TypeScript's instantiation depth.
  return admin.from(table).select(columns, { count: "exact" }) as SitesQuery
}

export function mergeAccessibleSites<T extends { id: string }>(...groups: T[][]): T[] {
  const map = new Map<string, T>()
  for (const group of groups) {
    for (const site of group) {
      if (site?.id) map.set(site.id, site)
    }
  }
  return [...map.values()]
}

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Site list request aborted")
}

export async function readPages<T>(
  createQuery: () => SitesQuery,
  orderColumn: string,
  signal?: AbortSignal
): Promise<T[]> {
  const rows: T[] = []
  let total: number | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    checkCancellation(signal)
    let query = createQuery().order(orderColumn, { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, error, count } = await query
    checkCancellation(signal)
    if (error) throw new Error(error.message || "Query failed")
    // Exact counts detect server-side caps, missing pages and changing totals.
    // A short page alone cannot establish that the list is complete.
    if (!Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0 ||
        (total !== undefined && total !== count)) {
      throw new Error("Could not verify complete site list")
    }
    total = count
    rows.push(...data as T[])
    if (rows.length === total) return rows
    if (rows.length > total || data.length === 0) {
      throw new Error("Incomplete site list")
    }
  }
  throw new Error("Site list pagination limit exceeded")
}

export const SITE_LIST_COLUMNS = "id, name, url, description, user_id, created_at, updated_at"

export async function listAccessibleSitesForUser(
  admin: SitesAdminClient,
  userId: string,
  signal?: AbortSignal
): Promise<{ sites: SiteRow[]; error: string | null }> {
  try {
    checkCancellation(signal)
    const [owned, memberships] = await Promise.all([
      readPages<SiteRow>(
        () => select(admin, "sites", SITE_LIST_COLUMNS)
          .eq("user_id", userId).is("archived_at", null),
        "id", signal
      ),
      readPages<{ site_id: string }>(
        // The service RPC checks the authenticated actor's effective license.
        // Stored suspension can lag on both expiry and restored coverage.
        () => admin.rpc("list_effective_selector_memberships", { p_user_id: userId }, { get: true, count: "exact" })
          .select("site_id") as SitesQuery,
        "id", signal
      ),
    ])
    checkCancellation(signal)
    const ownedIds = new Set(owned.map((site) => site.id))
    // Ownership rows were restricted to owned OR licensed member IDs, so they
    // contributed nothing to owned UNION memberships (including suspended users).
    const extraIds = [...new Set(memberships.map((row) => row.site_id))]
      .filter((id) => id && !ownedIds.has(id))
    const extra: SiteRow[] = []
    // Bound URLs, pagination and concurrent transport. Complete each wave before
    // starting another, and never publish an earlier wave after any read fails.
    for (let offset = 0; offset < extraIds.length; offset += ID_BATCH_SIZE * ID_BATCH_CONCURRENCY) {
      checkCancellation(signal)
      const wave: Array<Promise<SiteRow[]>> = []
      for (let index = 0; index < ID_BATCH_CONCURRENCY; index++) {
        const from = offset + index * ID_BATCH_SIZE
        const ids = extraIds.slice(from, from + ID_BATCH_SIZE)
        if (ids.length === 0) break
        wave.push(readPages<SiteRow>(
          () => select(admin, "sites", SITE_LIST_COLUMNS)
            .in("id", ids).is("archived_at", null),
          "id", signal
        ))
      }
      const groups = await Promise.all(wave)
      checkCancellation(signal)
      extra.push(...groups.flat())
    }
    checkCancellation(signal)
    return { sites: mergeAccessibleSites(owned, extra), error: null }
  } catch (error) {
    return {
      sites: [],
      error: signal?.aborted ? "Site list request aborted"
        : error instanceof Error && error.message ? error.message : "Query failed",
    }
  }
}
