import {
  computeKitchenDelta,
  mapSaleOrderItemsToDeltaLines,
  type KitchenDelta,
  type KitchenLine,
} from "@/lib/printer"

type PrintableOrderItem = {
  id?: string
  name?: string | null
  quantity?: number | string | null
  catalog_item_id?: string | null
  parent_sale_order_item_id?: string | null
  status?: string | null
  metadata?: {
    client_line_key?: string
    is_modifier?: boolean
    parent_client_line_key?: string
    parent_name?: string | null
    printed_quantity?: number | string | null
  } | null
}

export type OrderPrintMode = "full" | "delta"

export type OrderPrintTicket = {
  delta: KitchenDelta
  lines: KitchenLine[]
  printedItems: Array<{ id: string; quantity: number }>
}

function printedQuantity(item: PrintableOrderItem): number | null {
  const raw = item.metadata?.printed_quantity
  if (raw === null || raw === undefined || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function isParent(item: PrintableOrderItem) {
  return !item.parent_sale_order_item_id && !item.metadata?.is_modifier
}

function lineForItem(
  item: PrintableOrderItem,
  lines: ReturnType<typeof mapSaleOrderItemsToDeltaLines>,
): KitchenLine {
  const mapped = lines.find((line) => line.itemId === item.id)
  const key = mapped?.key || item.id || ""
  return {
    key,
    name: mapped?.name || item.name || "Item",
    quantity: Number(item.quantity) || 0,
    itemId: item.id,
    catalogItemId: mapped?.catalogItemId,
    modifiers: lines
      .filter((line) => line.parentKey === key)
      .map((line) => ({ name: line.name, quantity: line.quantity })),
  }
}

export function buildOrderPrintTicket(
  rawItems: PrintableOrderItem[],
  mode: OrderPrintMode,
): OrderPrintTicket {
  const items = rawItems || []
  const mapped = mapSaleOrderItemsToDeltaLines(items)
  const activeParents = items.filter(
    (item) =>
      isParent(item) &&
      item.status !== "draft" &&
      item.status !== "cancelled",
  )

  if (mode === "full") {
    const delta = computeKitchenDelta([], mapped)
    return {
      delta,
      lines: delta.adds,
      printedItems: activeParents
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id as string,
          quantity: Number(item.quantity) || 0,
        })),
    }
  }

  const adds: KitchenLine[] = []
  const qtyChanges: KitchenDelta["qtyChanges"] = []
  const voids: KitchenLine[] = []
  const printedItems: OrderPrintTicket["printedItems"] = []

  for (const item of items.filter(isParent)) {
    const current = Number(item.quantity) || 0
    const previous = printedQuantity(item)
    const line = lineForItem(item, mapped)

    if (item.status === "cancelled") {
      if (previous && previous > 0) {
        voids.push({ ...line, quantity: previous })
        if (item.id) printedItems.push({ id: item.id, quantity: 0 })
      }
      continue
    }
    if (item.status === "draft") continue

    if (previous === null) {
      if (item.status === "new") {
        adds.push(line)
        if (item.id) printedItems.push({ id: item.id, quantity: current })
      }
      continue
    }

    if (previous === 0 && current > 0) {
      adds.push(line)
      if (item.id) printedItems.push({ id: item.id, quantity: current })
    } else if (previous !== current) {
      qtyChanges.push({
        key: line.key,
        name: line.name,
        from: previous,
        to: current,
        itemId: item.id,
        modifiers: line.modifiers,
      })
      if (item.id) printedItems.push({ id: item.id, quantity: current })
    }
  }

  const delta: KitchenDelta =
    adds.length || qtyChanges.length || voids.length
      ? { kind: "delta", adds, qtyChanges, voids }
      : { kind: "none", adds: [], qtyChanges: [], voids: [] }

  return {
    delta,
    lines: activeParents.map((item) => lineForItem(item, mapped)),
    printedItems,
  }
}
