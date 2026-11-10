"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { getStorefrontCartPrices } from "@/app/commerce/storefront-cart-prices"
import { convertAmount } from "@/app/lib/fx"
import { cartLineKey, type CartModifier } from "@/app/commerce/cart-modifiers"

type Line = { id: string; lineKey?: string; site_id?: string; currency?: string | null; cartPrice: number;
  target_sale_price?: number | null; modifiers?: CartModifier[] }

export function useStorefrontCartPricing<T extends Line>(cart: T[], setCart: Dispatch<SetStateAction<T[]>>,
  channel: "shop" | "marketplace", enabled = true) {
  const { user, isLoading } = useAuthContext()
  const identity = `${user?.id || "guest"}:${user?.email || ""}`
  const [refresh, setRefresh] = useState(0)
  const retryPricing = useCallback(() => setRefresh(value => value + 1), [])
  useEffect(() => {
    let lastRefresh = Date.now()
    const revalidate = () => {
      if (Date.now() - lastRefresh < 20_000) return
      lastRefresh = Date.now()
      setRefresh(value => value + 1)
    }
    window.addEventListener("focus", revalidate)
    return () => window.removeEventListener("focus", revalidate)
  }, [])
  // Quantity edits do not need a new price read. Composition and account changes do.
  const key = JSON.stringify([identity, channel, refresh, cart.map(line => [cartLineKey(line), line.id, line.site_id,
    (line.modifiers || []).map(option => option.catalogItemId).sort()]).sort()])
  const current = useRef(key)
  const cartRef = useRef(cart)
  useLayoutEffect(() => { current.current = key; cartRef.current = cart }, [key, cart])
  const [settled, setSettled] = useState("")
  const [error, setError] = useState<{ key: string; message: string;
    affectedLineIds: string[]; unavailableItemIds: string[] }>()
  useEffect(() => {
    const cart = cartRef.current
    if (!enabled || isLoading || !cart.length) return
    let cancelled = false
    getStorefrontCartPrices({ channel, ids: [...new Set(cart.map(line => line.id))],
      modifierIds: [...new Set(cart.flatMap(line => (line.modifiers || []).map(option => option.catalogItemId)))] }).then(({ items, rates }) => {
      if (cancelled || current.current !== key) return
      const prices = new Map(items.map(item => [item.id, item]))
      // Collect every affected configuration before updating any prices.
      const affectedLineIds = new Set<string>()
      const unavailableItemIds = new Set<string>()
      for (const line of cart) {
        const price = prices.get(line.id)
        if (!price || (line.site_id && price.site_id !== line.site_id)) {
          affectedLineIds.add(cartLineKey(line))
          unavailableItemIds.add(line.id)
          continue
        }
        const currency = price.dynamic ? line.currency || price.currency : price.currency
        for (const option of line.modifiers || []) {
          const updated = prices.get(option.catalogItemId)
          if (!updated || updated.site_id !== price.site_id) {
            affectedLineIds.add(cartLineKey(line))
            unavailableItemIds.add(option.catalogItemId)
          } else if (convertAmount(updated.price, updated.currency, currency, rates) == null) {
            affectedLineIds.add(cartLineKey(line))
          }
        }
      }
      if (affectedLineIds.size) {
        setError({ key, affectedLineIds: [...affectedLineIds], unavailableItemIds: [...unavailableItemIds],
          message: unavailableItemIds.size ? "Some cart products or options are unavailable. Remove affected items or retry."
            : "Unable to refresh cart prices. Please retry before checking out." })
        return
      }
      setCart(previous => previous.map(line => {
        const price = prices.get(line.id)
        if (!price || (line.site_id && line.site_id !== price.site_id)) return line
        const currency = price.dynamic ? line.currency || price.currency : price.currency
        const modifiers = (line.modifiers || []).map(option => {
          const updated = prices.get(option.catalogItemId)
          const converted = updated && updated.site_id === price.site_id
            ? convertAmount(updated.price, updated.currency, currency, rates) : null
          return { ...option, cartPrice: converted ?? option.cartPrice }
        })
        return { ...line, currency, cartPrice: price.dynamic ? line.cartPrice : price.price,
          target_sale_price: price.dynamic ? line.target_sale_price : price.price, modifiers }
      }))
      setSettled(key)
      setError(undefined)
    }).catch(() => {
      if (!cancelled && current.current === key) setError({ key, affectedLineIds: [], unavailableItemIds: [],
        message: "Unable to refresh cart prices. Please retry before checking out." })
    })
    return () => { cancelled = true }
  }, [key, isLoading, channel, setCart, enabled])
  const activeError = enabled && cart.length > 0 && error?.key === key ? error : undefined
  return { pricingPending: enabled && cart.length > 0 && (isLoading || settled !== key),
    pricingError: activeError?.message, pricingAffectedLineIds: activeError?.affectedLineIds || [],
    pricingUnavailableItemIds: activeError?.unavailableItemIds || [], retryPricing }
}