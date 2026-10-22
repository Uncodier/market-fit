"use client"

import { useEffect, useState } from "react"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"

/** Child-specific groups override parent groups; the shared action owns fallback inheritance. */
export function useSelfServiceModifiers(hostId: string, selectedId: string | null, initialGroups: ModifierGroupWithItems[], initialError: boolean) {
  const [loaded, setLoaded] = useState({ id: hostId, groups: initialGroups, error: initialError })
  const [selection, setSelection] = useState<{ id: string; modifiers: CartModifier[] }>({ id: hostId, modifiers: [] })
  const target = selectedId || hostId
  useEffect(() => {
    if (target === loaded.id) return
    let cancelled = false
    getModifierGroupsForCatalogItem(target).then((result) => {
      if (!cancelled) setLoaded({ id: target, groups: result.data, error: !!result.error })
    }).catch(() => { if (!cancelled) setLoaded({ id: target, groups: [], error: true }) })
    return () => { cancelled = true }
  }, [target, loaded.id])
  return {
    groups: loaded.id === target ? loaded.groups : [],
    ready: loaded.id === target,
    error: loaded.id === target && loaded.error,
    modifiers: selection.id === target ? selection.modifiers : [],
    setModifiers: (modifiers: CartModifier[]) => setSelection({ id: target, modifiers }),
  }
}