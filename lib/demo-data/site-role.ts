type DemoRoleData = {
  sites?: { id: string; user_id?: string; archived_at?: string | null }[]
  site_ownership?: { site_id: string; user_id: string }[]
  site_members?: { site_id: string; user_id: string; role: string; status?: string }[]
}

/** Mirror the role RPC using only the selected demo's in-memory identity and sites. */
export function getDemoSiteRole(
  data: DemoRoleData,
  selectedSiteId: string,
  userId: string | null | undefined,
  requestedSiteId: unknown,
): string | null {
  if (!userId || requestedSiteId !== selectedSiteId) return null
  const site = data.sites?.find((row) => row.id === requestedSiteId)
  if (!site || site.archived_at != null) return null
  if (site.user_id === userId || data.site_ownership?.some(
    (row) => row.site_id === site.id && row.user_id === userId,
  )) return "owner"
  return data.site_members?.find(
    (row) => row.site_id === site.id && row.user_id === userId && row.status === "active",
  )?.role ?? null
}