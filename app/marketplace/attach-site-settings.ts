/**
 * Settings live on the `settings` table (not sites.settings).
 * Attaches each site's settings row onto item.site.settings for marketplace UI.
 */
export async function attachSiteSettings<T extends { site_id?: string; site?: any }>(
  supabase: { from: (table: string) => any },
  items: T[] | null | undefined,
): Promise<T[]> {
  if (!items?.length) return items || []

  const siteIds = Array.from(
    new Set(
      items
        .map((item) => item.site_id || item.site?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  if (!siteIds.length) return items

  const { data: settingsRows } = await supabase
    .from("settings")
    .select("*")
    .in("site_id", siteIds)

  const settingsBySite = new Map(
    (settingsRows || []).map((row: { site_id: string }) => [row.site_id, row]),
  )

  return items.map((item) => {
    if (!item.site) return item
    const siteId = item.site_id || item.site.id
    return {
      ...item,
      site: {
        ...item.site,
        settings: settingsBySite.get(siteId) || {},
      },
    }
  })
}
