"use client"

import { useEffect, useState } from "react"
import { getCartItems, setCartItems, slimCartItem } from "@/app/commerce/cart-storage"
import { useStorefrontCartPricing } from "./use-storefront-cart-pricing"
import type { CartModifier } from "@/app/commerce/cart-modifiers"

type StoredLine = { id: string; site_id?: string; currency?: string; cartPrice: number; cartQty: number; modifiers?: CartModifier[] }

/** PDP headers use the same refreshed amounts as the checkout cart. */
export function usePersistedCartPricing(source: "shop" | "marketplace", siteId?: string | null) {
  const [cart, setCart] = useState<StoredLine[]>([])
  const { pricingPending, pricingError } = useStorefrontCartPricing(cart, setCart, source)
  useEffect(() => {
    const read = () => setCart(getCartItems("cart", source, siteId))
    read()
    window.addEventListener("storage", read)
    return () => window.removeEventListener("storage", read)
  }, [source, siteId])
  useEffect(() => {
    if (pricingPending || pricingError || !cart.length) return
    // Only persist changed values; storage notifications must not produce a loop.
    const stored = getCartItems("cart", source, siteId)
    if (JSON.stringify(stored) !== JSON.stringify(cart.map(slimCartItem))) setCartItems("cart", source, siteId, cart)
  }, [cart, source, siteId, pricingPending, pricingError])
  return { cart, pricingPending, pricingError }
}