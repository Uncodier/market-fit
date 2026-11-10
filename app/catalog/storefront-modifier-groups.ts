import "server-only"

import { createServiceClient } from "@/lib/supabase/server"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"
import { applyStorefrontAvailability, isStorefrontAvailable } from "./storefront-availability"
import type { ModifierGroup, ModifierGroupWithItems } from "./modifier-types"

type Option = {
  id: string; site_id: string; status: string; name: string
  target_sale_price: number | null; currency: string | null
  image_url: string | null; description: string | null
  category: { name?: string } | { name?: string }[] | null
}
type Link = {
  site_id: string; catalog_item_id: string; modifier_group_id: string
  modifier_group: ModifierGroup | null
}
type OptionRow = {
  id: string; site_id: string; modifier_group_id: string
  catalog_item_id: string; sort_order: number; catalog_item: Option | null
}
const failure = () => ({ data: [] as ModifierGroupWithItems[], error: "Unable to load modifier groups" })

/** Public host authorization precedes any tenant-scoped modifier or pricing reads. Never shared-cache buyer prices. */
export async function getStorefrontModifierGroups(
  catalogItemId: string, channel: "shop" | "marketplace",
): Promise<{ data: ModifierGroupWithItems[]; error?: string }> {
  if (typeof catalogItemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogItemId) ||
    (channel !== "shop" && channel !== "marketplace")) return { data: [] }

  try {
    // The service-role public reader authorizes only this explicitly public host.
    const supabase = await createServiceClient(true, { access: "public" })
    const query = applyStorefrontAvailability(supabase.from("catalog_items")
      .select("id, site_id, parent_id, status, is_marketplace_listed, availability_mode, availability_status, site:sites!inner(id, archived_at)")
      .eq("id", catalogItemId).eq("status", "active").is("site.archived_at", null))
    const { data: host, error: hostError } = await query.single()
    if (hostError) return failure()
    if (!host || host.id !== catalogItemId || !host.site_id || host.status !== "active" || !isStorefrontAvailable(host)) return { data: [] }
    const site = Array.isArray(host.site) ? host.site[0] : host.site
    if (!site || site.id !== host.site_id || site.archived_at !== null) return { data: [] }

    const hostIds = [host.id]
    let listed = host.is_marketplace_listed === true
    if (host.parent_id) {
      const { data: parent, error } = await applyStorefrontAvailability(supabase.from("catalog_items")
        .select("id, site_id, status, is_marketplace_listed, availability_mode, availability_status")
        .eq("id", host.parent_id).eq("site_id", host.site_id).eq("status", "active")).maybeSingle()
      if (error) return failure()
      if (!parent || parent.site_id !== host.site_id || parent.id !== host.parent_id ||
        parent.status !== "active" || !isStorefrontAvailable(parent)) return { data: [] }
      hostIds.push(parent.id)
      listed ||= parent.is_marketplace_listed === true
    }
    if (!listed) return { data: [] }

    const links: Link[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("catalog_item_modifier_groups")
        .select("site_id, catalog_item_id, modifier_group_id, modifier_group:modifier_groups!inner(id, site_id, name, description, min_select, max_select, sort_order)")
        .eq("site_id", host.site_id).eq("modifier_group.site_id", host.site_id)
        .in("catalog_item_id", hostIds).order("sort_order").order("id").range(offset, offset + 499)
      if (error) return failure()
      links.push(...(data || []) as unknown as Link[])
      if (!data || data.length < 500) break
    }
    const scoped = links.filter(link => link.site_id === host.site_id && hostIds.includes(link.catalog_item_id) &&
      link.modifier_group !== null && link.modifier_group.site_id === host.site_id && link.modifier_group.id === link.modifier_group_id)
    const own = scoped.filter(link => link.catalog_item_id === host.id)
    const effective = own.length ? own : scoped.filter(link => link.catalog_item_id === host.parent_id)
    const groups = new Map(effective.map(link => [link.modifier_group_id, link.modifier_group!]))
    if (!groups.size) return { data: [] }

    const rows: OptionRow[] = []
    const groupIds = [...groups.keys()]
    // Chunk by query size, not by group: every group shares its option read and price overlay.
    for (let start = 0; start < groupIds.length; start += 200) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("modifier_group_items")
          .select("id, site_id, modifier_group_id, catalog_item_id, sort_order, catalog_item:catalog_items!catalog_item_id!inner(id, site_id, name, description, target_sale_price, currency, image_url, status, category:catalog_categories(name))")
          .eq("site_id", host.site_id).eq("catalog_item.site_id", host.site_id).eq("catalog_item.status", "active")
          .in("modifier_group_id", groupIds.slice(start, start + 200))
          .order("sort_order").order("id").range(offset, offset + 499)
        if (error) return failure()
        rows.push(...(data || []) as unknown as OptionRow[])
        if (!data || data.length < 500) break
      }
    }
    const visible = rows.filter(row => row.site_id === host.site_id && groups.has(row.modifier_group_id) &&
      row.catalog_item !== null && row.catalog_item.site_id === host.site_id && row.catalog_item.status === "active" && row.catalog_item.id === row.catalog_item_id)
    const options = [...new Map(visible.map(row => [row.catalog_item_id, row.catalog_item!])).values()]
    const defaults = await applyChannelPricesToItems(supabase, options, channel)
    const priced = new Map((await applyBuyerPricesToItems(defaults, channel)).map(item => [item.id, item]))
    const itemsByGroup = new Map<string, ModifierGroupWithItems["items"]>()
    for (const row of visible) {
      const item = priced.get(row.catalog_item_id)!
      const category = Array.isArray(item.category) ? item.category[0] : item.category
      const items = itemsByGroup.get(row.modifier_group_id) || []
      items.push({
        id: row.id, catalog_item_id: row.catalog_item_id, sort_order: row.sort_order ?? 0,
        name: item.name || "Unknown", price: Number(item.target_sale_price || 0), currency: item.currency || null,
        image_url: item.image_url || null, description: item.description || null,
        categoryName: category?.name?.trim() || null,
      })
      itemsByGroup.set(row.modifier_group_id, items)
    }
    return { data: [...groups.values()].map(group => ({
      id: group.id, site_id: group.site_id, name: group.name, description: group.description,
      min_select: group.min_select ?? 0, max_select: group.max_select ?? null, sort_order: group.sort_order ?? 0,
      items: itemsByGroup.get(group.id) || [],
    })) }
  } catch {
    return failure()
  }
}