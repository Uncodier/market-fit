export type SiteRow = {
  id: string
  [key: string]: unknown
}

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>

export type SitesAdminClient = {
  from: (table: string) => any
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

async function runQuery<T>(builder: QueryResult<T>): Promise<{ data: T[]; error: string | null }> {
  const { data, error } = await builder
  if (error) return { data: [], error: error.message || "Query failed" }
  return { data: data || [], error: null }
}

export async function listAccessibleSitesForUser(
  admin: SitesAdminClient,
  userId: string
): Promise<{ sites: SiteRow[]; error: string | null }> {
  const owned = await runQuery<SiteRow>(
    admin.from("sites").select("*").eq("user_id", userId)
  )
  if (owned.error) return { sites: [], error: owned.error }

  const memberships = await runQuery<{ site_id: string }>(
    admin.from("site_members").select("site_id").eq("user_id", userId).eq("status", "active")
  )
  const ownerships = await runQuery<{ site_id: string }>(
    admin.from("site_ownership").select("site_id").eq("user_id", userId)
  )

  const ownedIds = new Set(owned.data.map((site) => site.id))
  const extraIds = [
    ...(memberships.error ? [] : memberships.data.map((row) => row.site_id)),
    ...(ownerships.error ? [] : ownerships.data.map((row) => row.site_id)),
  ].filter((id) => id && !ownedIds.has(id))
  const uniqueExtraIds = [...new Set(extraIds)]

  if (uniqueExtraIds.length === 0) {
    return { sites: owned.data, error: null }
  }

  const extra = await runQuery<SiteRow>(
    admin.from("sites").select("*").in("id", uniqueExtraIds)
  )
  if (extra.error) return { sites: owned.data, error: null }

  return { sites: mergeAccessibleSites(owned.data, extra.data), error: null }
}
