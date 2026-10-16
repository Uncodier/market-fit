"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CheckoutFulfillmentMethod } from "./delivery-options"
import { readShopFulfillmentPreference, writeShopFulfillmentPreference } from "./shop-fulfillment-preference"

export function useShopFulfillmentPreference({
  siteId,
  setFulfillment,
}: {
  siteId?: string | null
  setFulfillment: (value: CheckoutFulfillmentMethod) => void
}) {
  const scope = siteId || null
  const [loadedScope, setLoadedScope] = useState<string | null | undefined>(undefined)
  const userChoseFulfillmentRef = useRef(false)
  const selectionSequence = useRef(0)

  useEffect(() => {
    let cancelled = false
    const sequence = selectionSequence.current
    // Restore after hydration, keeping automatic defaults gated until the state commits.
    void Promise.resolve().then(() => {
      if (cancelled || sequence !== selectionSequence.current) return
      const saved = readShopFulfillmentPreference(scope)
      userChoseFulfillmentRef.current = saved !== null
      if (saved !== null) setFulfillment(saved)
      setLoadedScope(scope)
    })
    return () => { cancelled = true }
  }, [scope, setFulfillment])

  const setFulfillmentByUser = useCallback((value: CheckoutFulfillmentMethod) => {
    selectionSequence.current += 1
    userChoseFulfillmentRef.current = true
    writeShopFulfillmentPreference(scope, value)
    setFulfillment(value)
    setLoadedScope(scope)
  }, [scope, setFulfillment])

  // Automatic defaults or compatibility fallbacks must never overwrite a saved choice.
  return { userChoseFulfillmentRef, setFulfillmentByUser, isPreferenceLoaded: loadedScope === scope }
}