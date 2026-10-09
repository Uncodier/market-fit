type DbClient = {
  from: (table: string) => any
}

type CheckoutLineLike = {
  catalogItemId: string
  modifiers?: { catalogItemId: string; quantity: number }[]
}

export async function upsertSaleOrderItemsWithModifiers(params: {
  supabase: DbClient
  supabaseAdmin: DbClient
  isAdmin: boolean
  siteId: string
  orderId: string
  existingOrderId?: string
  existingItems: any[]
  processedLines: any[]
  lines: CheckoutLineLike[]
  intent?: string
  isFullyPaid: boolean
}) {
  const {
    supabase,
    supabaseAdmin,
    isAdmin,
    siteId,
    orderId,
    existingOrderId,
    existingItems,
    processedLines,
    lines,
    intent,
    isFullyPaid,
  } = params

  const client = isAdmin ? supabaseAdmin : supabase

  const resolveItemStatus = (pl: any, existingItem: any) => {
    let newStatus = "draft"
    let sentAt: string | null = null

    if (intent === "complete" || (intent === "pay" && isFullyPaid)) {
      newStatus = "completed"
    } else if (intent === "send") {
      if (!existingItem || pl.quantity > existingItem.quantity) {
        newStatus = "new"
        sentAt = new Date().toISOString()
      } else {
        newStatus =
          existingItem.status === "draft" ? "new" : existingItem.status
        sentAt =
          existingItem.sent_at ||
          (newStatus === "new" ? new Date().toISOString() : null)
      }
    } else {
      newStatus = existingItem ? existingItem.status : "draft"
      sentAt = existingItem ? existingItem.sent_at : null
    }
    return { newStatus, sentAt }
  }

  const findExistingParent = (pl: any) => {
    if (pl.client_line_key) {
      const byKey = existingItems.find(
        (ei: any) =>
          !ei.parent_sale_order_item_id &&
          ei.metadata?.client_line_key === pl.client_line_key,
      )
      if (byKey) return byKey
    }
    if (
      !pl.parent_client_line_key &&
      !(lines.find((l) => l.catalogItemId === pl.catalog_item_id)?.modifiers
        ?.length)
    ) {
      return existingItems.find(
        (ei: any) =>
          !ei.parent_sale_order_item_id &&
          ei.catalog_item_id === pl.catalog_item_id &&
          !ei.metadata?.client_line_key,
      )
    }
    return undefined
  }

  const parentProcessed = processedLines.filter(
    (pl) => !pl.parent_client_line_key,
  )
  const childProcessed = processedLines.filter(
    (pl) => !!pl.parent_client_line_key,
  )
  const matchedExistingIds = new Set<string>()
  const clientKeyToDbId = new Map<string, string>()

  const upsertOne = async (payload: any) => {
    const {
      _is_reservation_dropin,
      _reservationStart,
      _reservationEnd,
      _isRoundRobinDropin,
      ...dbPayload
    } = payload
    let dbItem
    if (dbPayload.id) {
      const { data, error } = await client
        .from("sale_order_items")
        .update(dbPayload)
        .eq("id", dbPayload.id)
        .select()
        .single()
      if (error) {
        throw new Error(`Sale order item update error: ${error.message}`)
      }
      dbItem = data
    } else {
      delete dbPayload.id
      const { data, error } = await client
        .from("sale_order_items")
        .insert(dbPayload)
        .select()
        .single()
      if (error) {
        throw new Error(`Sale order item insert error: ${error.message}`)
      }
      dbItem = data
    }
    return {
      ...dbItem,
      _is_reservation_dropin,
      _reservationStart,
      _reservationEnd,
      _isRoundRobinDropin,
    }
  }

  const upsertedItems: any[] = []

  for (const pl of parentProcessed) {
    const existingItem = findExistingParent(pl)
    if (existingItem) matchedExistingIds.add(existingItem.id)
    const { newStatus, sentAt } = resolveItemStatus(pl, existingItem)
    const dbItem = await upsertOne({
      id: existingItem?.id,
      sale_order_id: orderId,
      site_id: siteId,
      catalog_item_id: pl.catalog_item_id,
      name: pl.name,
      description: pl.description,
      quantity: pl.quantity,
      unit_price: pl.unit_price,
      subtotal: pl.subtotal,
      status: newStatus,
      sent_at: sentAt,
      parent_sale_order_item_id: null,
      metadata: {
        ...(existingItem?.metadata &&
        typeof existingItem.metadata === "object"
          ? existingItem.metadata
          : {}),
        is_new: newStatus === "new",
        client_line_key: pl.client_line_key,
        parent_name: pl.parent_name,
        ...(pl.backorder_quantity !== undefined
          ? { backorder_quantity: pl.backorder_quantity }
          : {}),
      },
      _is_reservation_dropin: pl.is_reservation_dropin,
      _reservationStart: pl.reservationStart,
      _reservationEnd: pl.reservationEnd,
      _isRoundRobinDropin: pl.isRoundRobinDropin,
    })
    upsertedItems.push(dbItem)
    if (pl.client_line_key) clientKeyToDbId.set(pl.client_line_key, dbItem.id)
  }

  for (const pl of childProcessed) {
    const parentDbId = clientKeyToDbId.get(pl.parent_client_line_key)
    if (!parentDbId) {
      throw new Error("Modifier line is missing its parent order item")
    }
    const existingItem = existingItems.find(
      (ei: any) =>
        ei.parent_sale_order_item_id === parentDbId &&
        (ei.metadata?.client_line_key === pl.client_line_key ||
          (!ei.metadata?.client_line_key &&
            ei.catalog_item_id === pl.catalog_item_id)),
    )
    if (existingItem) matchedExistingIds.add(existingItem.id)
    const { newStatus, sentAt } = resolveItemStatus(pl, existingItem)
    const dbItem = await upsertOne({
      id: existingItem?.id,
      sale_order_id: orderId,
      site_id: siteId,
      catalog_item_id: pl.catalog_item_id,
      name: pl.name,
      description: pl.description,
      quantity: pl.quantity,
      unit_price: pl.unit_price,
      subtotal: pl.subtotal,
      status: newStatus,
      sent_at: sentAt,
      parent_sale_order_item_id: parentDbId,
      metadata: {
        ...(existingItem?.metadata &&
        typeof existingItem.metadata === "object"
          ? existingItem.metadata
          : {}),
        is_new: newStatus === "new",
        client_line_key: pl.client_line_key,
        modifier_group_id: pl.modifier_group_id,
        is_modifier: true,
        ...(pl.backorder_quantity !== undefined
          ? { backorder_quantity: pl.backorder_quantity }
          : {}),
      },
      _is_reservation_dropin: false,
      _reservationStart: undefined,
      _reservationEnd: undefined,
      _isRoundRobinDropin: false,
    })
    upsertedItems.push(dbItem)
  }

  if (existingOrderId && existingItems.length > 0) {
    const unmatchedItems = existingItems.filter(
      (ei) => !matchedExistingIds.has(ei.id),
    )
    // Retained modifiers must not be lost to a draft parent's FK cascade.
    const retainedParentIds = new Set(
      existingItems
        .filter((ei) => ei.parent_sale_order_item_id && ei.status !== "draft")
        .map((ei) => ei.parent_sale_order_item_id),
    )
    const removalItems = [
      ...unmatchedItems.filter((ei) => ei.parent_sale_order_item_id),
      ...unmatchedItems.filter((ei) => !ei.parent_sale_order_item_id),
    ]
    for (const ei of removalItems) {
      if (ei.status === "draft" && !retainedParentIds.has(ei.id)) {
        const { data, error } = await client
          .from("sale_order_items")
          .delete()
          .eq("id", ei.id)
          .eq("sale_order_id", orderId)
          .eq("site_id", siteId)
          .eq("status", "draft")
          .select("id")
          .single()
        if (error) {
          throw new Error(`Sale order item delete error: ${error.message}`)
        }
        if (data?.id !== ei.id) {
          throw new Error("Sale order item delete did not remove the requested item")
        }
        const { error: reservationError } = await supabaseAdmin
          .from("reservations")
          .delete()
          .eq("sale_order_item_id", ei.id)
          .eq("site_id", siteId)
        if (reservationError) {
          throw new Error(`Reservation cleanup error: ${reservationError.message}`)
        }
      } else {
        const { data, error } = await client
          .from("sale_order_items")
          .update({ status: "cancelled" })
          .eq("id", ei.id)
          .eq("sale_order_id", orderId)
          .eq("site_id", siteId)
          .select("id, status")
          .single()
        if (error) {
          throw new Error(`Sale order item cancellation error: ${error.message}`)
        }
        if (data?.id !== ei.id || data.status !== "cancelled") {
          throw new Error("Sale order item cancellation did not persist")
        }
      }
    }
  }

  return upsertedItems
}
