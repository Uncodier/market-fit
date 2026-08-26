import { pickNextRedeemableService } from "@/app/commerce/pass-round-robin-server"

type DbClient = {
  from: (table: string) => any
}

export type CheckoutDropinReservationItem = {
  id: string
  catalog_item_id: string
  quantity: number
  _is_reservation_dropin?: boolean
  _reservationStart?: string
  _reservationEnd?: string
  _isRoundRobinDropin?: boolean
}

type ExistingDropinReservation = {
  id: string
  catalog_item_id?: string | null
}

export function resolveDropinReservationCatalogItemId(params: {
  lineCatalogItemId: string
  hasReservationDates: boolean
  isRoundRobinDropin?: boolean
  existingCatalogItemId?: string | null
}): "round_robin" | string {
  const existingId = params.existingCatalogItemId || null
  if (!params.hasReservationDates && existingId) return existingId
  if (params.isRoundRobinDropin && params.hasReservationDates) return "round_robin"
  if (existingId && existingId !== params.lineCatalogItemId) return existingId
  return params.lineCatalogItemId
}

async function loadExistingDropinReservation(params: {
  supabaseAdmin: DbClient
  saleOrderItemId: string
  existingReservationId?: string | null
}): Promise<ExistingDropinReservation | null> {
  const { data: byItem } = await params.supabaseAdmin
    .from("reservations")
    .select("id, catalog_item_id")
    .eq("sale_order_item_id", params.saleOrderItemId)
    .maybeSingle()
  if (byItem) return byItem

  if (!params.existingReservationId) return null
  const { data: byId } = await params.supabaseAdmin
    .from("reservations")
    .select("id, catalog_item_id")
    .eq("id", params.existingReservationId)
    .maybeSingle()
  return byId || null
}

export async function syncCheckoutDropinReservations(params: {
  supabaseAdmin: DbClient
  siteId: string
  upsertedItems: CheckoutDropinReservationItem[]
  intent?: string
  isFullyPaid: boolean
  isAdmin: boolean
  finalLeadId?: string | null
  buyerUserId?: string | null
  ownerSiteId?: string | null
  /** Link this reservation instead of inserting a second capacity row. */
  existingReservationId?: string | null
}) {
  const {
    supabaseAdmin,
    siteId,
    upsertedItems,
    intent,
    isFullyPaid,
    isAdmin,
    finalLeadId,
    buyerUserId,
    ownerSiteId,
    existingReservationId,
  } = params

  for (const item of upsertedItems) {
    if (!item._is_reservation_dropin) {
      continue
    }

    const hasReservationDates = Boolean(item._reservationStart && item._reservationEnd)

    const existingRes = await loadExistingDropinReservation({
      supabaseAdmin,
      saleOrderItemId: item.id,
      existingReservationId,
    })

    const targetReservationId = existingRes?.id || existingReservationId || null
    if (!hasReservationDates && !targetReservationId) {
      continue
    }

    const resStatus =
      ["completed", "complete", "pay"].includes(intent || "") && isFullyPaid
        ? "confirmed"
        : "pending"

    const catalogDecision = resolveDropinReservationCatalogItemId({
      lineCatalogItemId: item.catalog_item_id,
      hasReservationDates,
      isRoundRobinDropin: item._isRoundRobinDropin,
      existingCatalogItemId: existingRes?.catalog_item_id,
    })
    const reservationCatalogItemId =
      catalogDecision === "round_robin"
        ? await pickNextRedeemableService({
            passCatalogItemId: item.catalog_item_id,
            siteId,
            startIso: item._reservationStart!,
            endIso: item._reservationEnd!,
            quantity: item.quantity,
            isAdmin,
            ignoreReservationId: existingRes?.id || targetReservationId || undefined,
            preferredMemberId: existingRes?.catalog_item_id,
          })
        : catalogDecision

    if (targetReservationId) {
      await supabaseAdmin
        .from("reservations")
        .update({
          status: resStatus,
          quantity: item.quantity,
          catalog_item_id: reservationCatalogItemId,
          ...(hasReservationDates
            ? {
                start_time: item._reservationStart,
                end_time: item._reservationEnd,
              }
            : {}),
          sale_order_item_id: item.id,
          ...(finalLeadId ? { lead_id: finalLeadId } : {}),
          buyer_user_id: buyerUserId || null,
          owner_site_id: ownerSiteId || null,
        })
        .eq("id", targetReservationId)
      continue
    }

    if (!finalLeadId && !isAdmin) {
      throw new Error("Reservations require a valid customer/lead.")
    }

    await supabaseAdmin.from("reservations").insert({
      site_id: siteId,
      catalog_item_id: reservationCatalogItemId,
      sale_order_item_id: item.id,
      lead_id: finalLeadId,
      buyer_user_id: buyerUserId || null,
      owner_site_id: ownerSiteId || null,
      start_time: item._reservationStart,
      end_time: item._reservationEnd,
      quantity: item.quantity,
      status: resStatus,
    })
  }
}
