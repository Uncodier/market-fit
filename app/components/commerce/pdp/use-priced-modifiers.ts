"use client"

import { useEffect, useState } from "react"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { convertAmount } from "@/app/lib/fx"

export function usePricedModifiers(hostId: string, channel: "shop" | "marketplace", currency: string) {
  const { rates } = useDisplayCurrency()
  const [groups, setGroups] = useState<ModifierGroupWithItems[]>([])
  const key = `${hostId}:${channel}:${currency}`
  const [selection, setSelection] = useState<{ key: string; items: CartModifier[] }>({ key, items: [] })
  const [loaded, setLoaded] = useState("")
  useEffect(() => {
    let cancelled = false
    getModifierGroupsForCatalogItem(hostId, channel).then(result => {
      if (cancelled) return
      if (result.error) return
      setGroups(result.data || [])
      setLoaded(key)
      setSelection({ key, items: [] })
    }).catch(() => { /* Keep purchase disabled when prices cannot be verified. */ })
    return () => { cancelled = true }
  }, [hostId, channel, key])
  const convertible = groups.every(group => group.items.every(option =>
    convertAmount(option.price, option.currency || currency, currency, rates) != null))
  const modifierGroups = groups.map(group => ({ ...group, items: group.items.map(option => {
    const price = convertAmount(option.price, option.currency || currency, currency, rates)
    return { ...option, price: price ?? 0, currency }
  }) }))
  return { modifierGroups: loaded === key ? modifierGroups : [],
    selectedModifiers: selection.key === key ? selection.items : [],
    setSelectedModifiers: (items: CartModifier[]) => setSelection({ key, items }), modifiersReady: loaded === key && convertible }
}