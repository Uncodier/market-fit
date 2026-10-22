import "server-only"
import { validateModifierSelections } from "@/app/catalog/modifier-validate"
import type { ModifierGroup, ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CheckoutLine, CheckoutSupabaseClient } from "./checkout-types"

/** Use PDP inheritance and validate required groups on the server, not just in the picker. */
export async function assertSelfServiceModifiers(
  supabase: CheckoutSupabaseClient, siteId: string,
  lines: CheckoutLine[], items: Array<{ id: string; parent_id?: string | null }>,
) {
  const hostIds = [...new Set(items.flatMap((item) => [item.id, ...(item.parent_id ? [item.parent_id] : [])]))]
  const { data: links, error } = await supabase.from("catalog_item_modifier_groups")
    .select("catalog_item_id, modifier_group:modifier_groups(id, site_id, name, min_select, max_select)")
    .eq("site_id", siteId).in("catalog_item_id", hostIds)
  if (error || !links) throw new Error("Unable to verify required modifiers.")
  const groupIds = [...new Set(links.map((link: { modifier_group: { id?: string } | null }) => link.modifier_group?.id).filter(Boolean))]
  let options: Array<{ modifier_group_id: string; catalog_item_id: string }> = []
  if (groupIds.length) {
    const result = await supabase.from("modifier_group_items")
      .select("modifier_group_id, catalog_item_id").eq("site_id", siteId).in("modifier_group_id", groupIds)
    if (result.error || !result.data) throw new Error("Unable to verify modifier options.")
    options = result.data
  }
  for (const line of lines) {
    const parent = items.find((item) => item.id === line.catalogItemId)?.parent_id
    const own = links.filter((link: { catalog_item_id: string }) => link.catalog_item_id === line.catalogItemId)
    const effective = own.length ? own : links.filter((link: { catalog_item_id: string }) => link.catalog_item_id === parent)
    const groups = effective.map((link: { modifier_group: ModifierGroup }) => {
      const group = link.modifier_group
      if (!group || group.site_id !== siteId) throw new Error("Invalid modifier group.")
      return { ...group, sort_order: 0, items: options.filter((option) => option.modifier_group_id === group.id)
        .map((option) => ({ id: option.catalog_item_id, catalog_item_id: option.catalog_item_id, sort_order: 0, name: "", price: 0 })) } satisfies ModifierGroupWithItems
    })
    const selections = (line.modifiers || []).map((modifier) => ({ ...modifier, groupId: modifier.groupId || "" }))
    const validation = validateModifierSelections(groups, selections)
    if (!validation.ok) throw new Error(validation.error)
  }
}