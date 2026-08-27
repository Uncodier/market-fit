import { createServiceClient } from "@/lib/supabase/server"
import { assertReservationSlot, getAvailableSlotsForItem } from "@/app/reservations/availability"
import {
  isRoundRobinPass,
  isRoundRobinPassOrParent,
  mergeMemberSlots,
  pickNextRedeemableMember,
  type SlotAvailability,
} from "@/app/commerce/pass-round-robin"
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability"

type RoundRobinMemberRow = {
  id: string
  kind?: string | null
  digital_subtype?: string | null
  redeem_assignment_mode?: string | null
  is_reservation?: boolean | null
  status?: string | null
  parent_id?: string | null
  availability_mode?: string | null
  availability_status?: string | null
  parent?: { status?: string | null } | { status?: string | null }[] | null
}

function isActiveRoundRobinMember(item: RoundRobinMemberRow | undefined): boolean {
  if (!item || item.status === "archived") return false
  const parent = Array.isArray(item.parent) ? item.parent[0] : item.parent
  if (parent?.status === "archived") return false
  if (!isStorefrontAvailable(item)) return false
  if (isRoundRobinPass(item)) return false
  return Boolean(item.is_reservation)
}

export async function listPassRoundRobinMemberIds(passCatalogItemId: string): Promise<string[]> {
  const supabase = await createServiceClient(true)
  
  // 1. Fetch the target item to see if it's a variant (has a parent)
  const { data: targetItem } = await supabase
    .from("catalog_items")
    .select("id, parent_id, metadata")
    .eq("id", passCatalogItemId)
    .single()
    
  if (!targetItem) {
    return []
  }
  
  const parentId = targetItem.parent_id || targetItem.id
  
  // 2. Load members mapped to the parent (or the item itself if no parent)
  const { data: rows, error } = await supabase
    .from("pass_redeemable_items")
    .select("reservable_catalog_item_id, sort_order, created_at")
    .eq("pass_catalog_item_id", parentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  let orderedIds = (rows || []).map((r) => r.reservable_catalog_item_id as string)
  
  if (orderedIds.length === 0) return []

  // Drop archived / unavailable members before variant mapping so their
  // still-active children are never considered.
  const { data: baseItems } = await supabase
    .from("catalog_items")
    .select("id, status, availability_mode, availability_status")
    .in("id", orderedIds)

  const baseById = new Map((baseItems || []).map((item) => [item.id, item]))
  orderedIds = orderedIds.filter((id) => {
    const item = baseById.get(id)
    if (!item || item.status === "archived") return false
    return isStorefrontAvailable(item)
  })

  if (orderedIds.length === 0) return []

  // 3. If target is a variant, we need to map the parent's members to their corresponding variants
  if (targetItem.parent_id) {
    const targetOptionValues = targetItem.metadata?.option_values || {}
    
    const mappedIds: string[] = []
    
    // Fetch all child variants of the members
    const { data: memberChildren } = await supabase
      .from("catalog_items")
      .select("id, name, parent_id, metadata")
      .in("parent_id", orderedIds)
      .eq("status", "active")
      
    const childrenByParent = new Map<string, any[]>()
    for (const child of (memberChildren || [])) {
      const arr = childrenByParent.get(child.parent_id) || []
      arr.push(child)
      childrenByParent.set(child.parent_id, arr)
    }
    
    // Try to find a matching variant for each member
    for (const memberId of orderedIds) {
      const children = childrenByParent.get(memberId) || []
      // Match by comparing option_values
      const match = children.find(child => {
        const childOptions = child.metadata?.option_values || {}
        // Check if all option values match
        return Object.keys(targetOptionValues).every(
          key => String(targetOptionValues[key]) === String(childOptions[key])
        )
      })
      if (match) {
        mappedIds.push(match.id)
      }
    }
    orderedIds = mappedIds
  }

  if (orderedIds.length === 0) return []

  const { data: items } = await supabase
    .from("catalog_items")
    .select("id, kind, digital_subtype, redeem_assignment_mode, is_reservation, status, parent_id, availability_mode, availability_status")
    .in("id", orderedIds)

  const byId = new Map<string, RoundRobinMemberRow>(
    (items || []).map((item) => [item.id, item as RoundRobinMemberRow]),
  )

  const parentIds = Array.from(
    new Set(
      (items || [])
        .map((item) => item.parent_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("catalog_items")
      .select("id, status")
      .in("id", parentIds)
    const parentStatus = new Map((parents || []).map((parent) => [parent.id, parent.status]))
    for (const item of byId.values()) {
      if (!item.parent_id) continue
      item.parent = { status: parentStatus.get(item.parent_id) ?? null }
    }
  }

  return orderedIds.filter((id) => isActiveRoundRobinMember(byId.get(id)))
}

export async function getMergedRoundRobinSlots(
  passCatalogItemId: string,
  startDateStr: string,
  endDateStr: string,
  qty: number = 1,
  ignoreReservationId?: string
): Promise<SlotAvailability[]> {
  const memberIds = await listPassRoundRobinMemberIds(passCatalogItemId)
  if (memberIds.length === 0) {
    return []
  }

  const lists = await Promise.all(
    memberIds.map((id) =>
      getAvailableSlotsForItem(id, startDateStr, endDateStr, qty, ignoreReservationId)
    )
  )
  const merged = mergeMemberSlots(lists)
  return merged
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

async function catalogItemIsRoundRobin(catalogItem: {
  id: string
  redeem_assignment_mode?: string | null
}): Promise<boolean> {
  if (isRoundRobinPass(catalogItem)) return true
  const supabase = await createServiceClient(true)
  const { data: item } = await supabase
    .from("catalog_items")
    .select("parent_id, redeem_assignment_mode")
    .eq("id", catalogItem.id)
    .maybeSingle()
  if (isRoundRobinPass(item)) return true
  if (!item?.parent_id) return false
  const { data: parent } = await supabase
    .from("catalog_items")
    .select("redeem_assignment_mode")
    .eq("id", item.parent_id)
    .maybeSingle()
  return isRoundRobinPassOrParent(item, parent)
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
  if (await catalogItemIsRoundRobin(params.catalogItem)) {
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
