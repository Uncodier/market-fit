import type { OrderLineModifier } from "./types"

type RawOrderItem = {
  id: string
  parent_sale_order_item_id?: string | null
  name: string
  description?: string | null
  quantity?: number | string | null
  metadata?: Record<string, unknown> | null
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key]
  return typeof value === "string" && value ? value : null
}

export function groupOrderLineModifiers(
  items: RawOrderItem[],
): Map<string, OrderLineModifier[]> {
  const parentIdByClientKey = new Map<string, string>()
  for (const item of items) {
    if (item.parent_sale_order_item_id || item.metadata?.is_modifier) continue
    const clientKey = metadataString(item.metadata, "client_line_key")
    if (clientKey) parentIdByClientKey.set(clientKey, item.id)
  }

  const grouped = new Map<string, OrderLineModifier[]>()
  for (const item of items) {
    const parentId =
      item.parent_sale_order_item_id ||
      parentIdByClientKey.get(
        metadataString(item.metadata, "parent_client_line_key") || "",
      )
    if (!parentId) continue
    const modifiers = grouped.get(parentId) || []
    modifiers.push({
      id: item.id,
      name: item.name,
      description: item.description || null,
      quantity: Number(item.quantity) || 1,
    })
    grouped.set(parentId, modifiers)
  }
  return grouped
}
