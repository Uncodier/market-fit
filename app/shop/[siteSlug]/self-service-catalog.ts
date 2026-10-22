import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import type { CatalogItem } from "@/app/types"

type Client = Awaited<ReturnType<typeof createServiceClient>>
type InventoryItem = Pick<CatalogItem, "id" | "availability_mode" | "availability_status" | "is_purchasable" | "_shop">
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Stock from another branch must never make a kiosk item appear available. */
export async function enrichSelfServiceInventory<T extends InventoryItem>(
  siteId: string, locationId: string, items: T[], suppliedClient?: Client,
): Promise<T[]> {
  if (!UUID.test(siteId) || !UUID.test(locationId)) throw new Error("Invalid self-service inventory scope.")
  const client = suppliedClient || await createServiceClient(true, { access: "public" })
  const [{ data: location, error: locationError }, { data: settings, error: settingsError }, { data: site, error: siteError }] = await Promise.all([
    client.from("locations").select("id").eq("id", locationId).eq("site_id", siteId).eq("is_active", true).maybeSingle(),
    client.from("settings").select("commerce").eq("site_id", siteId).maybeSingle(),
    client.from("sites").select("id").eq("id", siteId).is("archived_at", null).maybeSingle(),
  ])
  if (locationError || settingsError || siteError || !location || !site) throw new Error("Self-service inventory is unavailable.")
  const variantParents = items.filter((item) => item._shop?.hasVariants && !item._shop?.children?.length).map((item) => item.id)
  let variantChildren: CatalogItem[] = []
  if (variantParents.length) {
    const result = await client.from("catalog_items")
      .select("id, parent_id, availability_mode, availability_status, is_purchasable")
      .eq("site_id", siteId).eq("status", "active").eq("is_purchasable", true).in("parent_id", variantParents)
    if (result.error || !result.data) throw new Error("Unable to verify branch variants.")
    variantChildren = result.data
  }
  const all = items.flatMap((item) => [item, ...((item._shop?.children || []) as CatalogItem[])]).concat(variantChildren)
  const ids = [...new Set(all.map((item) => item.id))]
  if (!ids.length) return items
  const { data: levels, error } = await client.from("inventory_levels").select("catalog_item_id, quantity")
    .eq("site_id", siteId).eq("location_id", locationId).in("catalog_item_id", ids)
  if (error || !levels) throw new Error("Unable to verify branch inventory.")
  const quantities = new Map<string, number>()
  for (const level of levels) {
    const quantity = Number(level.quantity)
    if (!Number.isFinite(quantity)) throw new Error("Invalid branch inventory.")
    quantities.set(level.catalog_item_id, (quantities.get(level.catalog_item_id) || 0) + quantity)
  }
  const policy = settings?.commerce?.stock_shortage_policy || "allow"
  if (!["allow", "warn", "block"].includes(policy)) throw new Error("Invalid branch stock policy.")
  const enrich = (item: InventoryItem): InventoryItem => {
    const availableQty = item.availability_mode === "inventory" ? quantities.get(item.id) || 0 : undefined
    const stockAllowsSale = item.availability_mode === "inventory" ? availableQty! > 0 || policy !== "block"
      : item.availability_mode === "manual" ? item.availability_status === "available" : item._shop?.sellable !== false
    const sellable = item.is_purchasable !== false && !item._shop?.hasVariants && stockAllowsSale
    const children = (item._shop?.children || []) as CatalogItem[]
    const summarizedChildren = children.length ? children : variantChildren.filter((child) => child.parent_id === item.id)
    const enrichedChildren = summarizedChildren.map((child) => enrich(child) as CatalogItem)
    return { ...item, _shop: { ...item._shop,
      availableQty: enrichedChildren.length ? enrichedChildren.reduce((sum, child) => sum + (child._shop?.availableQty || 0), 0) : availableQty,
      sellable: enrichedChildren.length ? enrichedChildren.some((child) => child._shop?.sellable !== false) : sellable,
      ...(children.length ? { children: enrichedChildren } : {}) } }
  }
  return items.map((item) => enrich(item) as T)
}