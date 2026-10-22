"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"
import { modifiersSignature } from "@/app/commerce/cart-modifiers"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import type { CatalogItem } from "@/app/types"
import type { ShopSelfServiceContext } from "../shop-route-context"
import { readSelfServiceCart, writeSelfServiceCart, type SelfServiceCartItem } from "./self-service-storage"

type BuyerIdentity = { code: string; name: string }
type SelfServiceState = {
  context: ShopSelfServiceContext
  cart: SelfServiceCartItem[]
  fulfillment: CheckoutFulfillmentMethod
  setFulfillment: (value: CheckoutFulfillmentMethod) => void
  identity: BuyerIdentity | null
  setIdentity: (value: BuyerIdentity | null) => void
  promotion: { id: string; code?: string | null } | null
  setPromotion: (value: { id: string; code?: string | null } | null) => void
  addItem: (item: CatalogItem, quantity?: number, modifiers?: SelfServiceCartItem["modifiers"]) => void
  updateQty: (lineKey: string, delta: number) => void
  clearOrder: () => void
  startNewOrder: () => void
  ready: boolean
  orderVersion: number
}
const SelfServiceContext = createContext<SelfServiceState | null>(null)

export function SelfServiceProvider({ context, children }: { context: ShopSelfServiceContext; children: ReactNode }) {
  // Keying the inner provider prevents one location's memory from reaching another.
  return <LocationSession key={context.location.id} context={context}>{children}</LocationSession>
}

function LocationSession({ context, children }: { context: ShopSelfServiceContext; children: ReactNode }) {
  const [cart, setCart] = useState<SelfServiceCartItem[]>([])
  const [ready, setReady] = useState(false)
  const [orderVersion, setOrderVersion] = useState(0)
  const [identity, setIdentity] = useState<BuyerIdentity | null>(null)
  const [promotion, setPromotion] = useState<SelfServiceState["promotion"]>(null)
  const [fulfillment, setFulfillment] = useState<CheckoutFulfillmentMethod>(context.fulfillmentOptions[0] || "pickup")
  const { location, site, fulfillmentOptions } = context

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCart(readSelfServiceCart(location.id).filter((item) =>
        item.site_id === site.id && isSelfServiceItem(item, fulfillmentOptions, location.id)))
      setReady(true)
    })
    return () => { cancelled = true }
  }, [location.id, site.id, fulfillmentOptions])

  useEffect(() => {
    if (ready) writeSelfServiceCart(location.id, cart)
  }, [cart, ready, location.id])

  const addItem = useCallback<SelfServiceState["addItem"]>((item, quantity = 1, modifiers = []) => {
    if (item.site_id !== site.id || !isSelfServiceItem(item, fulfillmentOptions, location.id)) return
    const lineKey = modifiersSignature(item.id, modifiers)
    setCart((previous) => {
      const existing = previous.some((line) => (line.lineKey || line.id) === lineKey)
      return existing
        ? previous.map((line) => (line.lineKey || line.id) === lineKey ? { ...line, cartQty: line.cartQty + quantity } : line)
        : [...previous, { ...item, cartQty: quantity, cartPrice: Number(item.target_sale_price || 0), modifiers, lineKey }]
    })
  }, [site.id, location.id, fulfillmentOptions])

  const clearOrder = useCallback(() => {
    setCart([])
    setPromotion(null)
    setIdentity(null)
    setOrderVersion((version) => version + 1)
    writeSelfServiceCart(location.id, [])
  }, [location.id])
  const startNewOrder = useCallback(() => {
    clearOrder()
    setFulfillment(fulfillmentOptions[0] || "pickup")
  }, [clearOrder, fulfillmentOptions])

  return <SelfServiceContext.Provider value={{
    context, cart, fulfillment, setFulfillment, identity, setIdentity, promotion, setPromotion, addItem,
    updateQty: (key, delta) => setCart((previous) => previous
      .map((line) => (line.lineKey || line.id) === key ? { ...line, cartQty: Math.max(0, line.cartQty + delta) } : line)
      .filter((line) => line.cartQty > 0)),
    clearOrder, startNewOrder, ready, orderVersion,
  }}>{children}</SelfServiceContext.Provider>
}

export function useSelfService() {
  const value = useContext(SelfServiceContext)
  if (!value) throw new Error("Self-service UI requires a location session")
  return value
}

export function useOptionalSelfService() {
  return useContext(SelfServiceContext)
}