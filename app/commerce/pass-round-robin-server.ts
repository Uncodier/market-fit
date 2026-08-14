import { createServiceClient } from "@/lib/supabase/server"
import { assertReservationSlot, getAvailableSlotsForItem } from "@/app/reservations/availability"
import {
  isRoundRobinPass,
  mergeMemberSlots,
  pickNextRedeemableMember,
  type SlotAvailability,
} from "@/app/commerce/pass-round-robin"

export async function listPassRoundRobinMemberIds(passCatalogItemId: string): Promise<string[]> {
  const supabase = await createServiceClient(true)
  const { data: rows, error } = await supabase
    .from("pass_redeemable_items")
    .select("reservable_catalog_item_id, sort_order, created_at")
    .eq("pass_catalog_item_id", passCatalogItemId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  const orderedIds = (rows || []).map((r) => r.reservable_catalog_item_id as string)
  if (orderedIds.length === 0) return []

  const { data: items } = await supabase
    .from("catalog_items")
    .select("id, kind, digital_subtype, redeem_assignment_mode, is_reservation, status")
    .in("id", orderedIds)

  const byId = new Map((items || []).map((item) => [item.id, item]))
  return orderedIds.filter((id) => {
    const item = byId.get(id)
    if (!item || item.status === "archived") return false
    if (isRoundRobinPass(item)) return false
    return Boolean(item.is_reservation)
  })
}

export async function getMergedRoundRobinSlots(
  passCatalogItemId: string,
  startDateStr: string,
  endDateStr: string,
  qty: number = 1,
  ignoreReservationId?: string
): Promise<SlotAvailability[]> {
  const memberIds = await listPassRoundRobinMemberIds(passCatalogItemId)
  if (memberIds.length === 0) return []

  const lists = await Promise.all(
    memberIds.map((id) =>
      getAvailableSlotsForItem(id, startDateStr, endDateStr, qty, ignoreReservationId)
    )
  )
  return mergeMemberSlots(lists)
}

async function loadRoundRobinCursor(passCatalogItemId: string): Promise<number> {
  const supabase = await createServiceClient(true)
  const { data } = await supabase
    .from("pass_round_robin_state")
    .select("next_index")
    .eq("pass_catalog_item_id", passCatalogItemId)
    .maybeSingle()
  return data?.next_index ?? 0
}

async function saveRoundRobinCursor(params: {
  passCatalogItemId: string
  siteId: string
  nextIndex: number
  lastMemberId: string
}) {
  const supabase = await createServiceClient(true)
  const { error } = await supabase.from("pass_round_robin_state").upsert({
    pass_catalog_item_id: params.passCatalogItemId,
    site_id: params.siteId,
    next_index: params.nextIndex,
    last_member_id: params.lastMemberId,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

async function membersAvailableForSlot(params: {
  siteId: string
  memberIds: string[]
  startIso: string
  endIso: string
  quantity: number
  isAdmin: boolean
  ignoreReservationId?: string
}): Promise<string[]> {
  const available: string[] = []
  for (const memberId of params.memberIds) {
    try {
      await assertReservationSlot(
        params.siteId,
        memberId,
        params.startIso,
        params.endIso,
        params.quantity,
        params.isAdmin,
        params.ignoreReservationId
      )
      available.push(memberId)
    } catch {
      // Skip members that cannot take this slot
    }
  }
  return available
}

export async function pickNextRedeemableService(params: {
  passCatalogItemId: string
  siteId: string
  startIso: string
  endIso: string
  quantity: number
  isAdmin?: boolean
  ignoreReservationId?: string
  preferredMemberId?: string | null
}): Promise<string> {
  const memberIds = await listPassRoundRobinMemberIds(params.passCatalogItemId)
  if (memberIds.length === 0) {
    throw new Error("This pass has no reservable services to assign.")
  }

  const availableMemberIds = await membersAvailableForSlot({
    siteId: params.siteId,
    memberIds,
    startIso: params.startIso,
    endIso: params.endIso,
    quantity: params.quantity,
    isAdmin: params.isAdmin ?? false,
    ignoreReservationId: params.ignoreReservationId,
  })

  if (
    params.preferredMemberId &&
    availableMemberIds.includes(params.preferredMemberId)
  ) {
    return params.preferredMemberId
  }

  const nextIndex = await loadRoundRobinCursor(params.passCatalogItemId)
  const picked = pickNextRedeemableMember({
    orderedMemberIds: memberIds,
    nextIndex,
    availableMemberIds,
  })

  if (!picked) {
    throw new Error("No redeemable service is available for this slot.")
  }

  await saveRoundRobinCursor({
    passCatalogItemId: params.passCatalogItemId,
    siteId: params.siteId,
    nextIndex: picked.nextIndex,
    lastMemberId: picked.memberId,
  })

  return picked.memberId
}

export async function assertCommerceReservationSlot(params: {
  siteId: string
  catalogItem: {
    id: string
    kind?: string | null
    digital_subtype?: string | null
    redeem_assignment_mode?: string | null
  }
  startIso: string
  endIso: string
  quantity: number
  isAdmin?: boolean
  ignoreReservationId?: string
}) {
  if (isRoundRobinPass(params.catalogItem)) {
    const memberIds = await listPassRoundRobinMemberIds(params.catalogItem.id)
    if (memberIds.length === 0) {
      throw new Error("This pass has no reservable services to assign.")
    }
    const availableMemberIds = await membersAvailableForSlot({
      siteId: params.siteId,
      memberIds,
      startIso: params.startIso,
      endIso: params.endIso,
      quantity: params.quantity,
      isAdmin: params.isAdmin ?? false,
      ignoreReservationId: params.ignoreReservationId,
    })
    if (availableMemberIds.length === 0) {
      throw new Error("No redeemable service is available for this slot.")
    }
    return
  }

  await assertReservationSlot(
    params.siteId,
    params.catalogItem.id,
    params.startIso,
    params.endIso,
    params.quantity,
    params.isAdmin ?? false,
    params.ignoreReservationId
  )
}
