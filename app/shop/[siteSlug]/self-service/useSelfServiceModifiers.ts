"use client"

import { startTransition, useEffect, useState } from "react"
import { getSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options-actions"
import type { SelfServiceModifierOptions, SelfServiceModifierRequest } from "@/app/commerce/self-service-modifier-options"
import type { CartModifier } from "@/app/commerce/cart-modifiers"

const EMPTY_MODIFIERS: CartModifier[] = []

/** Every scope change revalidates options, prices, and stock through the same public loader. */
export function useSelfServiceModifiers(request: SelfServiceModifierRequest, initial: SelfServiceModifierOptions, initialFulfillment: string) {
  const { locationId, hostId, selectedId, fulfillment } = request
  const target = selectedId || hostId
  const key = `${locationId}:${hostId}:${target}:${fulfillment}`
  const initialKey = `${locationId}:${hostId}:${hostId}:${initialFulfillment}`
  const [loaded, setLoaded] = useState({ key: initialKey, result: initial })
  const [selection, setSelection] = useState<{ key: string; modifiers: CartModifier[] }>({ key: initialKey, modifiers: EMPTY_MODIFIERS })
  useEffect(() => {
    if (key === loaded.key) return
    let cancelled = false
    startTransition(async () => {
      let result: SelfServiceModifierOptions
      try { result = await getSelfServiceModifierOptions({ locationId, hostId, selectedId: target, fulfillment }) }
      catch { result = { data: [], error: "Unable to load product options. Please reload this page before ordering." } }
      if (!cancelled) {
        setLoaded({ key, result })
        setSelection({ key, modifiers: EMPTY_MODIFIERS })
      }
    })
    return () => { cancelled = true }
  }, [key, loaded.key, locationId, hostId, target, fulfillment])
  return {
    key,
    groups: loaded.key === key ? loaded.result.data : [],
    ready: loaded.key === key,
    error: loaded.key === key ? loaded.result.error : undefined,
    unavailableReason: loaded.key === key ? loaded.result.unavailableReason : undefined,
    modifiers: loaded.key === key && selection.key === key ? selection.modifiers : EMPTY_MODIFIERS,
    setModifiers: (modifiers: CartModifier[]) => setSelection({ key, modifiers }),
  }
}