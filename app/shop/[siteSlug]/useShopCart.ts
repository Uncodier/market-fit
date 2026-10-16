"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { CatalogItem } from "@/app/types"
import { isAccessOnlyItem, requiresVariantSelection } from "@/app/catalog/product-details"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { cartLineKey } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"
import { readPendingStorefrontPromo } from "@/app/components/commerce/storefront-pending-promo"

type ShopCartItem = CatalogItem & {
  cartQty: number
  cartPrice: number
  reservationStart?: string
  reservationEnd?: string
}

type Options = {
  siteId: string
  siteSlug: string
  currency: string
  ownedAccessMap: Map<string, boolean>
  orderSuccess: boolean
  trackEvent: (event: string, properties: Record<string, string | number>) => void
  setPromotionCode: (code: string) => void
  setPromotionId: (id: string | null) => void
}

export function useShopCart({
  siteId, siteSlug, currency, ownedAccessMap, orderSuccess,
  trackEvent, setPromotionCode, setPromotionId,
}: Options) {
  const router = useRouter()
  const [cart, setCart] = useState<ShopCartItem[]>([])
  const [loadedSiteId, setLoadedSiteId] = useState<string | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [deviceOrders, setDeviceOrders] = useState<DeviceOrder[]>([])

  const addToCart = useCallback((item: CatalogItem) => {
    const detailUrl = `/shop/${siteSlug}/${item.id}`
    if (ownedAccessMap.has(item.id)) {
      window.location.href = detailUrl
      return
    }
    if (item.is_dynamic_price || requiresVariantSelection(item) || item._shop?.hasRequiredModifiers) {
      router.push(detailUrl)
      return
    }
    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`${detailUrl}/book`)
      return
    }

    trackEvent("add_to_cart", {
      item_id: item.id,
      item_name: item.name,
      price: item.target_sale_price || 0,
      currency,
    })
    setCart((previous) => {
      const existing = previous.find((line) => line.id === item.id)
      return existing
        ? previous.map((line) => line.id === item.id ? { ...line, cartQty: line.cartQty + 1 } : line)
        : [...previous, { ...item, site_id: item.site_id || siteId, cartQty: 1, cartPrice: item.target_sale_price || 0 }]
    })
    toast.success(`${item.name} added to cart`)
    setIsCartOpen(true)
  }, [ownedAccessMap, siteSlug, router, siteId, currency, trackEvent])

  useEffect(() => {
    let cancelled = false
    // Hydrate browser-owned storage after commit; ignore work from a previous site.
    queueMicrotask(() => {
      if (cancelled) return
      setDeviceOrders(getDeviceOrders(siteId))
      const url = new URL(window.location.href)
      const justOrdered = url.searchParams.get("ordered") === "1" ||
        url.searchParams.get("success") === "true" || url.hash === "#your-orders"

      if (justOrdered) {
        setCart([])
        clearCart("cart", "shop", siteId)
        setIsCartOpen(false)
        url.searchParams.delete("success")
        url.searchParams.delete("order_id")
        url.searchParams.delete("ordered")
        window.history.replaceState({}, "", url.pathname + url.search + "#your-orders")
        requestAnimationFrame(() => {
          document.getElementById("your-orders")?.scrollIntoView({ behavior: "smooth", block: "start" })
        })
        window.setTimeout(() => {
          document.getElementById("your-orders")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 250)
      } else {
        setCart(getCartItems("cart", "shop", siteId).filter((item: ShopCartItem) => !item.site_id || item.site_id === siteId))
        const pending = readPendingStorefrontPromo()
        if (pending && pending.surface === "shop" && pending.siteId === siteId) {
          if (pending.code) setPromotionCode(pending.code)
          setPromotionId(pending.promotionId)
          setIsCartOpen(true)
        } else if (url.searchParams.get("cart") === "1") {
          setIsCartOpen(true)
        }
      }
      setLoadedSiteId(siteId)
    })
    return () => { cancelled = true }
  }, [siteId, setPromotionCode, setPromotionId])

  useEffect(() => {
    if (orderSuccess || loadedSiteId !== siteId) return
    const scopedCart = cart.filter((item) => !item.site_id || item.site_id === siteId)
    if (scopedCart.length !== cart.length) {
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) setCart(scopedCart)
      })
      return () => { cancelled = true }
    }
    setCartItems("cart", "shop", siteId, cart)
  }, [cart, siteId, orderSuccess, loadedSiteId])

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((previous) => previous
      .map((line) => cartLineKey(line) === id ? { ...line, cartQty: Math.max(0, line.cartQty + delta) } : line)
      .filter((line) => line.cartQty > 0))
  }, [])

  return { cart, setCart, isCartOpen, setIsCartOpen, deviceOrders, setDeviceOrders, addToCart, updateQty }
}