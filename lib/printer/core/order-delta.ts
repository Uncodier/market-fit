import type {
  DeltaLineInput,
  KitchenDelta,
  KitchenLine,
  KitchenModifier,
} from "./types"

function isParent(line: DeltaLineInput): boolean {
  return !line.parentKey && !line.isModifier
}

function wasSent(line: DeltaLineInput): boolean {
  return Boolean(line.status && line.status !== "draft")
}

function hasStableKey(line: DeltaLineInput): boolean {
  return Boolean(line.key && line.key !== line.itemId)
}

function matchExisting(
  existing: DeltaLineInput[],
  next: DeltaLineInput,
  used: Set<string>,
): DeltaLineInput | undefined {
  const unused = existing.filter((e) => !used.has(e.itemId || e.key))
  if (hasStableKey(next)) {
    const byKey = unused.find((e) => e.key === next.key)
    if (byKey) return byKey
  }
  if (next.parentKey || next.isModifier) return undefined
  return unused.find(
    (e) =>
      isParent(e) &&
      !hasStableKey(e) &&
      e.catalogItemId &&
      e.catalogItemId === next.catalogItemId,
  )
}

function modifiersFor(
  parent: DeltaLineInput,
  all: DeltaLineInput[],
): KitchenModifier[] {
  return all
    .filter((l) => l.parentKey === parent.key && parent.key)
    .map((l) => ({ name: l.name, quantity: l.quantity }))
}

function toKitchenLine(
  line: DeltaLineInput,
  all: DeltaLineInput[],
): KitchenLine {
  return {
    key: line.key,
    name: line.name,
    quantity: line.quantity,
    itemId: line.itemId,
    catalogItemId: line.catalogItemId,
    modifiers: modifiersFor(line, all),
  }
}

/**
 * Diff existing sale_order_items vs the next cart lines.
 * First send (no previously sent parents) → full ticket.
 * Later send → ADD / qty change / VOID. Draft-only removals are silent.
 */
export function computeKitchenDelta(
  existingItems: DeltaLineInput[],
  nextLines: DeltaLineInput[],
): KitchenDelta {
  const existingParents = existingItems.filter(isParent)
  const nextParents = nextLines.filter((l) => isParent(l) && l.status !== "cancelled")
  const sentParents = existingParents.filter((l) => wasSent(l) && l.status !== "cancelled")

  if (sentParents.length === 0) {
    return {
      kind: "full",
      adds: nextParents
        .filter((p) => p.status !== "draft")
        .map((p) => toKitchenLine(p, nextLines)),
      qtyChanges: [],
      voids: [],
    }
  }

  const matchedExisting = new Set<string>()
  const adds: KitchenLine[] = []
  const qtyChanges: KitchenDelta["qtyChanges"] = []

  for (const next of nextParents) {
    const existing = matchExisting(existingParents, next, matchedExisting)
    if (!existing) {
      adds.push(toKitchenLine(next, nextLines))
      continue
    }
    const matchId = existing.itemId || existing.key
    matchedExisting.add(matchId)
    if (!wasSent(existing)) {
      adds.push(toKitchenLine(next, nextLines))
      continue
    }
    if (next.quantity !== existing.quantity) {
      qtyChanges.push({
        key: next.key || existing.key,
        name: next.name || existing.name,
        from: existing.quantity,
        to: next.quantity,
        itemId: existing.itemId,
        modifiers: modifiersFor(next, nextLines),
      })
    }
  }

  const voids: KitchenLine[] = []
  for (const existing of sentParents) {
    const matchId = existing.itemId || existing.key
    if (matchedExisting.has(matchId)) continue
    voids.push(toKitchenLine(existing, existingItems))
  }

  if (adds.length === 0 && qtyChanges.length === 0 && voids.length === 0) {
    return { kind: "none", adds: [], qtyChanges: [], voids: [] }
  }

  return { kind: "delta", adds, qtyChanges, voids }
}

export function kitchenDeltaHasWork(delta: KitchenDelta | null | undefined): boolean {
  if (!delta || delta.kind === "none") return false
  if (delta.kind === "full") return delta.adds.length > 0
  return (
    delta.adds.length > 0 ||
    delta.qtyChanges.length > 0 ||
    delta.voids.length > 0
  )
}

export function mapSaleOrderItemToDeltaLine(item: {
  id?: string
  name?: string
  quantity?: number
  catalog_item_id?: string | null
  parent_sale_order_item_id?: string | null
  status?: string | null
  metadata?: {
    client_line_key?: string
    is_modifier?: boolean
    parent_client_line_key?: string
    parent_name?: string | null
  } | null
}): DeltaLineInput {
  const meta = item.metadata || {}
  const isModifier = Boolean(
    item.parent_sale_order_item_id || meta.is_modifier,
  )
  
  let finalName = item.name || "Item"
  if (meta.parent_name && !finalName.startsWith(meta.parent_name)) {
    finalName = `${meta.parent_name} -> ${finalName}`
  }

  return {
    key: meta.client_line_key || item.id || "",
    name: finalName,
    quantity: Number(item.quantity) || 0,
    catalogItemId: item.catalog_item_id ?? null,
    parentKey: meta.parent_client_line_key || null,
    isModifier,
    status: item.status ?? null,
    itemId: item.id,
  }
}

export function mapSaleOrderItemsToDeltaLines(items: any[]): DeltaLineInput[] {
  const list = items || []
  const byId = new Map(list.map((item) => [item.id, item]))
  return list.map((item) => {
    const parent = item.parent_sale_order_item_id
      ? byId.get(item.parent_sale_order_item_id)
      : null
    const parentKey =
      item.metadata?.parent_client_line_key ||
      parent?.metadata?.client_line_key ||
      parent?.id ||
      null
    return mapSaleOrderItemToDeltaLine({
      ...item,
      metadata: {
        ...(item.metadata || {}),
        parent_client_line_key: parentKey,
      },
    })
  })
}

export function mapProcessedLineToDeltaLine(line: {
  client_line_key?: string
  parent_client_line_key?: string | null
  name?: string
  quantity?: number
  catalog_item_id?: string | null
  id?: string
  parent_name?: string | null
}): DeltaLineInput {
  let finalName = line.name || "Item"
  if (line.parent_name && !finalName.startsWith(line.parent_name)) {
    finalName = `${line.parent_name} -> ${finalName}`
  }

  return {
    key: line.client_line_key || line.id || "",
    name: finalName,
    quantity: Number(line.quantity) || 0,
    catalogItemId: line.catalog_item_id ?? null,
    parentKey: line.parent_client_line_key || null,
    isModifier: Boolean(line.parent_client_line_key),
    itemId: line.id,
  }
}
