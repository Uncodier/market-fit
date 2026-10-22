type MarkedItem = { metadata?: Record<string, unknown> | null }

function markedItems(items: unknown): MarkedItem[] {
  return Array.isArray(items)
    ? items.filter((item): item is MarkedItem => Boolean(item && typeof item === "object"))
    : []
}

/** Only server-persisted metadata establishes an existing order's payment gate. */
export function isSelfServiceOrder(order: unknown): boolean {
  if (!order || typeof order !== "object") return false
  return markedItems((order as { items?: unknown }).items)
    .some((item) => item.metadata?.self_service === true)
}

export function selfServiceLocationFromItems(items: unknown): string | undefined {
  const marker = markedItems(items).find((item) => item.metadata?.self_service === true)
  const locationId = marker?.metadata?.self_service_location_id
  return typeof locationId === "string" && locationId ? locationId : undefined
}

export function selfServiceMetadata(locationId?: string, selfService = Boolean(locationId)) {
  return selfService ? {
    self_service: true,
    ...(locationId ? { self_service_location_id: locationId } : {}),
  } : {}
}

export function isPersistedSelfServiceSalePaid(sale: {
  status?: unknown
  amount_due?: unknown
} | null | undefined): boolean {
  if (!sale || sale.status !== "completed" || sale.amount_due == null) return false
  const due = Number(sale.amount_due)
  return Number.isFinite(due) && due >= 0 && due <= 0.009
}

export function selfServiceLineState(
  isFullyPaid: boolean,
  existingItem?: { status?: string; sent_at?: string | null },
) {
  // Do not re-send work already released, prepared, served, or cancelled.
  if (existingItem?.status && existingItem.status !== "draft") {
    return { newStatus: existingItem.status, sentAt: existingItem.sent_at || null }
  }
  return isFullyPaid
    ? { newStatus: "new", sentAt: new Date().toISOString() }
    : { newStatus: "draft", sentAt: null }
}