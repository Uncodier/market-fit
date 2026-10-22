import "server-only"

import { createServiceClient } from "@/lib/supabase/server"
import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details"
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CatalogItem } from "@/app/types"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { enrichSelfServiceInventory } from "@/app/shop/[siteSlug]/self-service-catalog"
import { resolveSelfServiceLocation } from "./self-service"
import { isSelfServiceItem, type SelfServiceFulfillment } from "./self-service-options"

export type SelfServiceModifierRequest = {
  locationId: string
  hostId: string
  selectedId?: string | null
  fulfillment: string
}
export type SelfServiceModifierOptions = {
  data: ModifierGroupWithItems[]
  error?: string
  unavailableReason?: string
}

type GroupLink = { catalog_item_id: string; modifier_group: Omit<ModifierGroupWithItems, "items"> | null }
type OptionLink = { id: string; modifier_group_id: string; catalog_item_id: string; sort_order: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ITEM_FIELDS = "id, site_id, parent_id, name, description, image_url, currency, target_sale_price, kind, status, is_marketplace_listed, is_purchasable, is_recurring, is_reservation, is_dynamic_price, metadata, availability_mode, availability_status"

/** Public read: authorize the branch and public host before loading their attached options. */
export async function loadSelfServiceModifierOptions(input: SelfServiceModifierRequest): Promise<SelfServiceModifierOptions> {
  const validId = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
  if (!input || !validId(input.locationId) || !validId(input.hostId) ||
    (input.selectedId != null && !validId(input.selectedId)) || !["pickup", "dine_in"].includes(input.fulfillment)) {
    return { data: [], error: "Invalid product option request." }
  }
  try {
    const client = await createServiceClient(true, { access: "public" })
    const context = await resolveSelfServiceLocation(input.locationId, client)
    const fulfillment = input.fulfillment as SelfServiceFulfillment
    if (!context || !context.fulfillmentOptions.includes(fulfillment)) return { data: [], error: "This order type is unavailable at this location." }
    const siteId = context.site.id
    const selectedId = input.selectedId || input.hostId
    const readItems = async (ids: string[]): Promise<CatalogItem[]> => {
      if (!ids.length) return []
      const result = await client.from("catalog_items").select(ITEM_FIELDS).eq("site_id", siteId).in("id", [...new Set(ids)])
      if (result.error || !result.data) throw new Error("Catalog lookup failed")
      return result.data
    }
    const hosts = await readItems([input.hostId, selectedId])
    const host = hosts.find((item) => item.id === input.hostId)
    const selected = hosts.find((item) => item.id === selectedId)
    if (!host || !selected || (selectedId !== host.id && selected.parent_id !== host.id)) {
      return { data: [], error: "This product is unavailable at this location." }
    }
    const [parent] = host.parent_id ? await readItems([host.parent_id]) : []
    const compatible = (item: CatalogItem) => item.site_id === siteId && item.status === "active" &&
      isStorefrontAvailable(item) && isSelfServiceItem(item, [fulfillment], input.locationId)
    if ((host.parent_id && (!parent || !compatible(parent))) ||
      !(host.is_marketplace_listed || parent?.is_marketplace_listed) ||
      !compatible(mergeParentIntoCatalogItem(host, parent)) || !compatible(mergeParentIntoCatalogItem(selected, selectedId === host.id ? parent : host))) {
      return { data: [], error: "This product is unavailable for your selected order type." }
    }

    const fallbackId = selected.parent_id
    const { data: links, error: linksError } = await client.from("catalog_item_modifier_groups")
      .select("catalog_item_id, modifier_group:modifier_groups(id, site_id, name, description, min_select, max_select, sort_order)")
      .eq("site_id", siteId).in("catalog_item_id", [...new Set([selectedId, ...(fallbackId ? [fallbackId] : [])])])
      .order("sort_order", { ascending: true })
    if (linksError || !links) throw new Error("Modifier lookup failed")
    const own = (links as GroupLink[]).filter((link) => link.catalog_item_id === selectedId)
    const effective = own.length ? own : (links as GroupLink[]).filter((link) => link.catalog_item_id === fallbackId)
    const groups = [...new Map(effective.map((link) => {
      if (!link.modifier_group || link.modifier_group.site_id !== siteId) throw new Error("Invalid modifier group")
      return [link.modifier_group.id, link.modifier_group] as const
    })).values()]
    if (!groups.length) return { data: [] }
    const optionsResult = await client.from("modifier_group_items")
      .select("id, modifier_group_id, catalog_item_id, sort_order").eq("site_id", siteId)
      .in("modifier_group_id", groups.map((group) => group.id)).order("sort_order", { ascending: true })
    if (optionsResult.error || !optionsResult.data) throw new Error("Modifier option lookup failed")
    const options = optionsResult.data as OptionLink[]
    const items = await readItems(options.map((option) => option.catalog_item_id))
    const parents = await readItems(items.flatMap((item) => item.parent_id ? [item.parent_id] : []))
    const eligible = items.flatMap((item) => {
      const optionParent = parents.find((candidate) => candidate.id === item.parent_id)
      if (item.parent_id && (!optionParent || !compatible(optionParent))) return []
      const effectiveItem = mergeParentIntoCatalogItem(item, optionParent)
      return compatible(effectiveItem) && effectiveItem.is_purchasable !== false ? [effectiveItem] : []
    })
    const [stocked, settingsResult] = await Promise.all([
      enrichSelfServiceInventory(siteId, input.locationId, eligible, client),
      client.from("settings").select("commerce").eq("site_id", siteId).maybeSingle(),
    ])
    if (settingsResult.error) throw new Error("Stock policy lookup failed")
    const blockShortage = settingsResult.data?.commerce?.stock_shortage_policy === "block"
    const priced = await applyChannelPricesToItems(client, stocked.filter((item) => item._shop?.sellable !== false), "shop")
    const byId = new Map(priced.map((item) => [item.id, item]))
    const data = groups.map((group): ModifierGroupWithItems => ({
      ...group,
      items: options.filter((option) => option.modifier_group_id === group.id).flatMap((option) => {
        const item = byId.get(option.catalog_item_id)
        if (!item) return []
        return [{ id: option.id, catalog_item_id: item.id, sort_order: option.sort_order,
          name: item.name, price: Number(item.target_sale_price || 0), currency: item.currency,
          description: item.description, image_url: item.image_url }]
      }),
    }))
    // Min/max count units, not distinct products: one available option can supply several units.
    const impossible = data.find((group) => {
      if (group.min_select <= 0) return false
      if (group.max_select != null && group.max_select < group.min_select) return true
      const capacity = group.items.reduce((sum, option) => {
        const item = byId.get(option.catalog_item_id)!
        return sum + (blockShortage && item.availability_mode === "inventory" ? Math.max(0, item._shop?.availableQty || 0) : Infinity)
      }, 0)
      return capacity < group.min_select
    })
    return { data, ...(impossible ? { unavailableReason: `This item is unavailable: not enough options in ${impossible.name} for this location and order type. Please choose another item or ask staff for help.` } : {}) }
  } catch {
    return { data: [], error: "Unable to load product options. Please reload this page before ordering." }
  }
}