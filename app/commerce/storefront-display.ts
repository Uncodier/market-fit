import { createServiceClient } from "@/lib/supabase/server"
import { getAvailableSlots } from "@/app/reservations/availability"
import { addDays, format, startOfDay } from "date-fns"

export interface StorefrontDisplayData {
  buyers?: { id: string; name: string | null; avatar_url: string | null }[]
  buyerCount?: number
  nextSlotAvailable?: number
  nextSlotCapacity?: number
  soldQty?: number
}

export async function loadStorefrontDisplay(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  items: any[]
): Promise<Map<string, StorefrontDisplayData>> {
  const result = new Map<string, StorefrontDisplayData>()
  if (!items || items.length === 0) return result

  const itemsWithBuyers = items.filter((item) => item.metadata?.show_buyers)
  const itemsWithInventory = items.filter(
    (item) => item.metadata?.show_available_inventory && !item.is_reservation
  )
  const itemsWithNextSlot = items.filter(
    (item) => item.is_reservation && item.metadata?.show_available_inventory
  )

  const [buyerDataMap, soldQtyMap, nextSlotDataMap] = await Promise.all([
    fetchBuyersData(supabase, itemsWithBuyers),
    fetchSoldQtyData(supabase, itemsWithInventory),
    fetchNextSlotData(itemsWithNextSlot),
  ])

  for (const item of items) {
    const b = buyerDataMap.get(item.id)
    const soldQty = soldQtyMap.get(item.id)
    const n = nextSlotDataMap.get(item.id)
    if (b || n || soldQty !== undefined) {
      result.set(item.id, {
        ...(b || {}),
        ...(n || {}),
        ...(soldQty !== undefined ? { soldQty } : {}),
      })
    }
  }

  return result
}

async function fetchBuyersData(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  items: any[]
): Promise<Map<string, { buyers: any[]; buyerCount: number }>> {
  const map = new Map<string, { buyers: any[]; buyerCount: number }>()
  if (items.length === 0) return map

  const parentToChildren = new Map<string, string[]>()
  const childToParent = new Map<string, string>()
  const allItemIds = new Set<string>()

  for (const item of items) {
    allItemIds.add(item.id)
    if (item._shop?.children?.length) {
      const childIds = item._shop.children.map((c: any) => c.id)
      parentToChildren.set(item.id, childIds)
      for (const cid of childIds) {
        childToParent.set(cid, item.id)
        allItemIds.add(cid)
      }
    }
  }

  const parentsNeedingChildren = items
    .map((item) => item.id)
    .filter((id) => !parentToChildren.has(id))

  if (parentsNeedingChildren.length > 0) {
    const { data: childRows } = await supabase
      .from("catalog_items")
      .select("id, parent_id")
      .in("parent_id", parentsNeedingChildren)
      .eq("status", "active")

    for (const row of childRows || []) {
      if (!row.parent_id || !row.id) continue
      const existing = parentToChildren.get(row.parent_id) || []
      existing.push(row.id)
      parentToChildren.set(row.parent_id, existing)
      childToParent.set(row.id, row.parent_id)
      allItemIds.add(row.id)
    }
  }

  const idsArray = Array.from(allItemIds)

  const [salesRes, resRes] = await Promise.all([
    supabase
      .from("sale_order_items")
      .select("catalog_item_id, sale_orders!inner(buyer_user_id, status, created_at)")
      .in("catalog_item_id", idsArray)
      .not("sale_orders.buyer_user_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("reservations")
      .select("catalog_item_id, buyer_user_id, created_at")
      .in("catalog_item_id", idsArray)
      .in("status", ["confirmed", "completed"])
      .not("buyer_user_id", "is", null)
      .order("created_at", { ascending: false }),
  ])

  const buyersByItem = new Map<string, Map<string, string>>() // itemId -> buyerId -> timestamp

  const addBuyer = (itemId: string, buyerId: string, timestamp: string) => {
    let resolvedItemId = itemId
    if (childToParent.has(itemId)) {
      resolvedItemId = childToParent.get(itemId)!
    }

    if (!buyersByItem.has(resolvedItemId)) {
      buyersByItem.set(resolvedItemId, new Map())
    }
    const itemMap = buyersByItem.get(resolvedItemId)!
    if (!itemMap.has(buyerId)) {
      itemMap.set(buyerId, timestamp)
    } else {
      const existing = itemMap.get(buyerId)!
      if (new Date(timestamp) > new Date(existing)) {
        itemMap.set(buyerId, timestamp)
      }
    }
  }

  if (salesRes.data) {
    for (const row of salesRes.data) {
      const order = Array.isArray(row.sale_orders) ? row.sale_orders[0] : row.sale_orders
      if (order?.buyer_user_id && order.status !== 'cancelled' && order.status !== 'refunded') {
        addBuyer(row.catalog_item_id!, order.buyer_user_id, order.created_at)
      }
    }
  }

  if (resRes.data) {
    for (const row of resRes.data) {
      if (row.buyer_user_id) {
        addBuyer(row.catalog_item_id!, row.buyer_user_id, row.created_at)
      }
    }
  }

  const allBuyerIds = new Set<string>()
  const orderedBuyersByItem = new Map<string, string[]>()

  for (const [itemId, buyerMap] of Array.from(buyersByItem.entries())) {
    const sorted = Array.from(buyerMap.entries())
      .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
      .map((entry) => entry[0])

    orderedBuyersByItem.set(itemId, sorted)
    for (const bid of sorted.slice(0, 4)) {
      allBuyerIds.add(bid)
    }
  }

  const profileMap = new Map<string, { id: string; name: string | null; avatar_url: string | null }>()
  if (allBuyerIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", Array.from(allBuyerIds))

    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, p)
      }
    }

    await hydrateBuyerAvatarsFromAuth(supabase, profileMap, Array.from(allBuyerIds))
  }

  for (const item of items) {
    const buyerIds = orderedBuyersByItem.get(item.id) || []
    if (buyerIds.length > 0) {
      const displayBuyers = buyerIds
        .slice(0, 4)
        .map((id) => profileMap.get(id))
        .filter(Boolean)

      map.set(item.id, {
        buyers: displayBuyers,
        buyerCount: buyerIds.length,
      })
    }
  }

  return map
}

async function hydrateBuyerAvatarsFromAuth(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  profileMap: Map<string, { id: string; name: string | null; avatar_url: string | null }>,
  buyerIds: string[]
) {
  const getUserById = supabase.auth?.admin?.getUserById
  if (typeof getUserById !== "function") return

  const missing = buyerIds.filter((id) => {
    const profile = profileMap.get(id)
    return !profile?.avatar_url || !profile?.name
  })

  await Promise.all(
    missing.map(async (id) => {
      try {
        const { data } = await getUserById(id)
        const user = data?.user
        if (!user) return
        const existing = profileMap.get(id)
        const meta = user.user_metadata || {}
        profileMap.set(id, {
          id,
          name:
            existing?.name ||
            meta.full_name ||
            meta.name ||
            (user.email ? user.email.split("@")[0] : null),
          avatar_url:
            existing?.avatar_url ||
            meta.avatar_url ||
            meta.picture ||
            null,
        })
      } catch {
        // Keep the profiles-table row if auth lookup fails.
      }
    })
  )
}

async function fetchSoldQtyData(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  items: any[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (items.length === 0) return map

  const childToParent = new Map<string, string>()
  const allItemIds = new Set<string>()

  for (const item of items) {
    allItemIds.add(item.id)
    const children: any[] = item._shop?.children || []
    for (const child of children) {
      if (!child?.id) continue
      allItemIds.add(child.id)
      childToParent.set(child.id, item.id)
    }
  }

  const parentsNeedingChildren = items
    .map((item) => item.id)
    .filter((id) => !items.some((item) => item.id === id && item._shop?.children?.length))

  if (parentsNeedingChildren.length > 0) {
    const { data: childRows } = await supabase
      .from("catalog_items")
      .select("id, parent_id")
      .in("parent_id", parentsNeedingChildren)
      .eq("status", "active")

    for (const row of childRows || []) {
      if (!row.parent_id || !row.id) continue
      childToParent.set(row.id, row.parent_id)
      allItemIds.add(row.id)
    }
  }

  const { data: rows } = await supabase
    .from("sale_order_items")
    .select("catalog_item_id, quantity, sale_orders!inner(status)")
    .in("catalog_item_id", Array.from(allItemIds))

  for (const row of rows || []) {
    const order = Array.isArray(row.sale_orders) ? row.sale_orders[0] : row.sale_orders
    if (order?.status === "cancelled" || order?.status === "refunded") continue
    const itemId = childToParent.get(row.catalog_item_id) || row.catalog_item_id
    if (!itemId) continue
    map.set(itemId, (map.get(itemId) || 0) + Number(row.quantity || 1))
  }

  return map
}

async function fetchNextSlotData(
  items: any[]
): Promise<Map<string, { nextSlotAvailable: number; nextSlotCapacity?: number }>> {
  const map = new Map<string, { nextSlotAvailable: number; nextSlotCapacity?: number }>()
  if (items.length === 0) return map

  const start = startOfDay(new Date())
  const end = addDays(start, 30) // Look ahead up to 30 days

  // Using Promise.all, but limited to the items that actually have the flag
  await Promise.all(
    items.map(async (item) => {
      try {
        const slots = await getAvailableSlots(
          item.id,
          format(start, "yyyy-MM-dd"),
          format(end, "yyyy-MM-dd"),
          1
        )
        if (slots && slots.length > 0) {
          map.set(item.id, { 
            nextSlotAvailable: slots[0].available,
            nextSlotCapacity: slots[0].capacity
          })
        }
      } catch (err) {
        console.error(`Failed to fetch slots for item ${item.id}`, err)
      }
    })
  )

  return map
}
