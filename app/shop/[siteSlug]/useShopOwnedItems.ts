"use client"

import { useEffect, useMemo, useState } from "react"
import type { CatalogItem } from "@/app/types"
import { getShopItemsByIds, getShopUserOwnedItems, type ShopOwnedAccess } from "./actions"

export function useShopOwnedItems(
  siteId: string,
  user: { id: string } | null,
  initialAccess: ShopOwnedAccess[],
  initialItems: CatalogItem[],
) {
  const [access, setAccess] = useState(initialAccess)
  const [items, setItems] = useState(initialItems)
  const ownedAccessMap = useMemo(() => new Map(access.map((entry) => [entry.catalogItemId, entry.canBook])), [access])

  // Ownership is per buyer; public catalog responses remain cacheable.
  useEffect(() => {
    let cancelled = false
    async function loadOwned() {
      if (!user) {
        setAccess([])
        setItems([])
        return
      }
      try {
        const owned = await getShopUserOwnedItems(siteId)
        if (cancelled) return
        setAccess(owned)
        const ids = owned.map((entry) => entry.catalogItemId)
        if (ids.length === 0) {
          setItems([])
          return
        }
        const { data } = await getShopItemsByIds(siteId, ids)
        if (!cancelled) setItems((data || []) as CatalogItem[])
      } catch {
        if (!cancelled) {
          setAccess([])
          setItems([])
        }
      }
    }
    void loadOwned()
    return () => { cancelled = true }
  }, [user, siteId])

  return { ownedAccessMap, ownedItemsData: items }
}