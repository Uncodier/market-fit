import { applyLocationInventoryDelta, type InventoryDeltaClient } from "./inventory-delta"

type QueryClient = InventoryDeltaClient & {
  from: (table: string) => any
}

export type RestockOrderLine = {
  catalog_item_id?: string | null
  id?: string | null
  quantity?: number | null
}

async function addStock(
  supabase: QueryClient,
  siteId: string,
  locationId: string,
  catalogItemId: string,
  quantity: number,
) {
  if (!catalogItemId || !(quantity > 0)) return

  const { data: catalogItem } = await supabase
    .from("catalog_items")
    .select("track_inventory")
    .eq("id", catalogItemId)
    .maybeSingle()

  if (!catalogItem?.track_inventory) return

  await applyLocationInventoryDelta(supabase, {
    siteId,
    locationId,
    catalogItemId,
    delta: quantity,
    floorZero: false,
  })
}

function catalogItemIdFromLine(line: RestockOrderLine): string | null {
  return line.catalog_item_id || null
}

export function shouldRestockOrder(
  orderStatus: string | null | undefined,
  options?: { saleAlreadyPaid?: boolean },
): boolean {
  if (!orderStatus || orderStatus === "cancelled") return false
  if (orderStatus === "pending") return Boolean(options?.saleAlreadyPaid)
  return true
}

export async function restockOrderInventory(
  supabase: QueryClient,
  order: {
    id: string
    site_id: string
    status?: string | null
    origin_location_id?: string | null
    items?: RestockOrderLine[] | null
    saleAlreadyPaid?: boolean
  },
): Promise<void> {
  if (!shouldRestockOrder(order.status, { saleAlreadyPaid: order.saleAlreadyPaid })) return

  const { data: settings } = await supabase
    .from("settings")
    .select("commerce")
    .eq("site_id", order.site_id)
    .maybeSingle()

  const policy = settings?.commerce?.decrement_stock_on || "ship"
  if (policy === "never") return

  const { data: decrementedShipments } = await supabase
    .from("shipments")
    .select("id, origin_location_id, stock_decremented, status")
    .eq("sale_order_id", order.id)
    .eq("stock_decremented", true)

  if (decrementedShipments && decrementedShipments.length > 0) {
    for (const shipment of decrementedShipments) {
      if (!shipment.origin_location_id) continue

      const { data: shippedItems } = await supabase
        .from("sale_order_items")
        .select("catalog_item_id, quantity")
        .eq("sale_order_id", order.id)
        .eq("shipment_id", shipment.id)

      for (const item of shippedItems || []) {
        const catalogItemId = catalogItemIdFromLine(item)
        if (!catalogItemId) continue
        await addStock(
          supabase,
          order.site_id,
          shipment.origin_location_id,
          catalogItemId,
          item.quantity || 1,
        )
      }

      const shipmentUpdate: { stock_decremented: boolean; status?: string } = {
        stock_decremented: false,
      }
      if (shipment.status !== "delivered") {
        shipmentUpdate.status = "cancelled"
      }

      await supabase
        .from("shipments")
        .update(shipmentUpdate)
        .eq("id", shipment.id)
    }
    return
  }

  if (!order.origin_location_id) return

  const { data: saleOrderItems } = await supabase
    .from("sale_order_items")
    .select("catalog_item_id, quantity")
    .eq("sale_order_id", order.id)

  const lines: RestockOrderLine[] =
    saleOrderItems && saleOrderItems.length > 0
      ? saleOrderItems
      : Array.isArray(order.items)
        ? order.items
        : []

  for (const line of lines) {
    const catalogItemId = catalogItemIdFromLine(line)
    if (!catalogItemId) continue
    await addStock(
      supabase,
      order.site_id,
      order.origin_location_id,
      catalogItemId,
      line.quantity || 1,
    )
  }
}
