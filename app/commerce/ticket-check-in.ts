"use server"

import { createClient } from "@/lib/supabase/server"
import {
  findPosClientMutation,
  recordPosClientMutation,
} from "@/app/pos/actions/idempotency"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function checkInReservation({
  code,
  siteId,
  userId,
  supabase,
}: {
  code: string
  siteId: string
  userId: string
  supabase: Awaited<ReturnType<typeof createClient>>
}) {
  if (!UUID_RE.test(code)) return null

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, status, catalog_item_id, entitlement_id, site_id, catalog_item:catalog_items(name)")
    .eq("id", code)
    .eq("site_id", siteId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!reservation) return null

  if (reservation.status === "cancelled") {
    return { error: "Reservation cancelled" }
  }
  if (reservation.status === "completed") {
    return { error: "Already checked in" }
  }
  if (!["pending", "confirmed"].includes(reservation.status)) {
    return { error: "Invalid reservation status" }
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservation.id)

  if (updateError) return { error: updateError.message }

  if (reservation.entitlement_id) {
    await supabase.from("ticket_check_ins").insert({
      site_id: siteId,
      entitlement_id: reservation.entitlement_id,
      catalog_item_id: reservation.catalog_item_id,
      scanned_by_user_id: userId,
      code,
      status: "valid",
    })
  }

  return {
    success: true,
    message: "Reservation checked in successfully",
    itemName: (reservation as any).catalog_item?.name || "Reservation",
  }
}

export async function checkInTicket({
  code,
  siteId,
  clientMutationId,
}: {
  code: string
  siteId: string
  clientMutationId?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" }

  const { data: membership } = await supabase
    .from("site_members")
    .select("status")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .single()

  if (!membership || membership.status !== "active") {
    return { error: "Not authorized for this site" }
  }

  if (clientMutationId) {
    const existing = await findPosClientMutation(siteId, clientMutationId)
    if (existing.data?.result) {
      return {
        success: true,
        message: existing.data.result.message || "Checked in",
        itemName: existing.data.result.itemName || "Item",
        idempotent: true,
      }
    }
  }

  const reservationResult = await checkInReservation({
    code,
    siteId,
    userId: user.id,
    supabase,
  })
  if (reservationResult) {
    if (clientMutationId && reservationResult.success) {
      await recordPosClientMutation({
        siteId,
        clientMutationId,
        kind: "check_in",
        result: {
          success: true,
          message: reservationResult.message,
          itemName: reservationResult.itemName,
        },
      })
    }
    return reservationResult
  }

  // Entitlement check-in: access_token, ticket_token, or entitlement id
  let orQuery = `metadata->>access_token.eq.${code},metadata->>ticket_token.eq.${code}`
  if (UUID_RE.test(code)) {
    orQuery += `,id.eq.${code}`
  }

  const { data: entitlements, error: entError } = await supabase
    .from("entitlements")
    .select("*, catalog_item:catalog_items(name)")
    .eq("site_id", siteId)
    .or(orQuery)

  if (entError) return { error: entError.message }
  if (!entitlements || entitlements.length === 0) {
    return { error: "Invalid code" }
  }

  const activeEntitlement = entitlements.find((e) => e.status === "active")

  if (!activeEntitlement) {
    const used = entitlements.find((e) => e.status === "used")
    if (used) return { error: "Already used" }
    return { error: "Invalid status" }
  }

  const entitlement = activeEntitlement

  const now = new Date()
  if (entitlement.expires_at && new Date(entitlement.expires_at) < now) {
    return { error: "Expired" }
  }

  if (entitlement.uses_remaining !== null && entitlement.uses_remaining <= 0) {
    return { error: "Already used" }
  }

  const newUses = entitlement.uses_remaining !== null ? entitlement.uses_remaining - 1 : null
  const newStatus = newUses === 0 ? "used" : "active"

  const { error: updateError } = await supabase
    .from("entitlements")
    .update({
      uses_remaining: newUses,
      status: newStatus,
    })
    .eq("id", entitlement.id)

  if (updateError) return { error: updateError.message }

  const { error: insertError } = await supabase.from("ticket_check_ins").insert({
    site_id: siteId,
    entitlement_id: entitlement.id,
    catalog_item_id: entitlement.catalog_item_id,
    scanned_by_user_id: user.id,
    code,
    status: "valid",
  })

  if (insertError) {
    console.error("Failed to record check-in", insertError)
  }

  const isPass = entitlement.metadata?.access_token && !entitlement.metadata?.ticket_token
  const usesLeftMsg = newUses !== null ? ` (${newUses} uses left)` : ""

  const result = {
    success: true as const,
    message: isPass ? "Pass checked in successfully" : "Ticket checked in successfully",
    itemName: `${(entitlement as any).catalog_item?.name || "Item"}${usesLeftMsg}`,
  }

  if (clientMutationId) {
    await recordPosClientMutation({
      siteId,
      clientMutationId,
      kind: "check_in",
      result,
    })
  }

  return result
}
