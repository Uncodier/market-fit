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
    if (!item._is_reservation_dropin || !item._reservationStart || !item._reservationEnd) {
      continue
    }

    const { data: existingRes } = await supabaseAdmin
      .from("reservations")
      .select("id, catalog_item_id")
      .eq("sale_order_item_id", item.id)
      .maybeSingle()

    const targetReservationId = existingRes?.id || existingReservationId || null

    const resStatus =
      ["completed", "complete", "pay"].includes(intent || "") && isFullyPaid
        ? "confirmed"
        : "pending"

    let reservationCatalogItemId = item.catalog_item_id
    if (item._isRoundRobinDropin) {
      reservationCatalogItemId = await pickNextRedeemableService({
        passCatalogItemId: item.catalog_item_id,
        siteId,
        startIso: item._reservationStart,
        endIso: item._reservationEnd,
        quantity: item.quantity,
        isAdmin,
        ignoreReservationId: existingRes?.id || targetReservationId || undefined,
        preferredMemberId: existingRes?.catalog_item_id,
      })
    }

    if (targetReservationId) {
      await supabaseAdmin
        .from("reservations")
        .update({
          status: resStatus,
          quantity: item.quantity,
          catalog_item_id: reservationCatalogItemId,
          start_time: item._reservationStart,
          end_time: item._reservationEnd,
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
