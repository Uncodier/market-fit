import type { SupabaseClient } from "@supabase/supabase-js"
import type { CatalogItem } from "@/app/types"

/** Use the existing public catalog reader; expose only a selection flag to cards. */
export async function loadShopRequiredModifierIds(
  supabase: Pick<SupabaseClient, "from">,
  siteId: string,
  items: Pick<CatalogItem, "id" | "parent_id">[],
): Promise<Set<string>> {
  if (items.length === 0) return new Set()
  const hostIds = [...new Set(items.flatMap((item) => [item.id, ...(item.parent_id ? [item.parent_id] : [])]))]
  const { data, error } = await supabase
    .from("catalog_item_modifier_groups")
    .select("catalog_item_id, modifier_group:modifier_groups(min_select, site_id)")
    .eq("site_id", siteId)
    .in("catalog_item_id", hostIds)

  // Unknown requirements must never allow an unconfigured direct addition.
  if (error) return new Set(items.map((item) => item.id))

  const linksByHost = new Map<string, boolean[]>()
  for (const link of data || []) {
    const group = Array.isArray(link.modifier_group) ? link.modifier_group[0] : link.modifier_group
    if (!group || group.site_id !== siteId) continue
    const requirements = linksByHost.get(link.catalog_item_id) || []
    requirements.push(Number(group.min_select ?? 0) > 0)
    linksByHost.set(link.catalog_item_id, requirements)
  }

  return new Set(items.filter((item) => {
    // Match PDP precedence: a child's own groups replace inherited parent groups.
    const requirements = linksByHost.get(item.id) ?? linksByHost.get(item.parent_id || "") ?? []
    return requirements.some(Boolean)
  }).map((item) => item.id))
}