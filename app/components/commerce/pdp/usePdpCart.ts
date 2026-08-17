"use client"

import { usePathname, useRouter } from "next/navigation"
import { setCartItems, getCartItems } from "@/app/commerce/cart-storage"
import {
  modifiersSignature,
  type CartModifier,
} from "@/app/commerce/cart-modifiers"

export const usePdpCart = (siteId: string) => {
  const pathname = usePathname()
  const router = useRouter()
  const isMarketplace = pathname?.startsWith("/marketplace")
  const source = isMarketplace ? "marketplace" : "shop"

  const addToCartStorage = (
    item: any,
    qty: number = 1,
    reservationStart?: string,
    reservationEnd?: string,
    modifiers: CartModifier[] = [],
    reservationAvailableQty?: number,
  ) => {
    try {
      const current = getCartItems("cart", source, siteId).filter(
        (c: any) =>
          source !== "shop" || !siteId || !c.site_id || c.site_id === siteId,
      )

      const sig = modifiersSignature(item.id, modifiers)
      const existingIdx = current.findIndex((c: any) => {
        const cSig = modifiersSignature(c.id, c.modifiers || [])
        return (
          cSig === sig &&
          c.reservationStart === reservationStart &&
          c.reservationEnd === reservationEnd
        )
      })

      if (existingIdx >= 0) {
        current[existingIdx].cartQty += qty
        // Optionally update available qty if we got a fresher number
        if (reservationAvailableQty !== undefined) {
          current[existingIdx].reservationAvailableQty = reservationAvailableQty
        }
      } else {
        current.push({
          ...item,
          site_id: item.site_id || siteId,
          cartQty: qty,
          cartPrice: item.target_sale_price || 0,
          currency: item.currency || "USD",
          reservationStart,
          reservationEnd,
          reservationAvailableQty,
          modifiers,
          lineKey: sig,
        })
      }

      const scoped =
        source === "shop" && siteId
          ? current.filter((c: any) => !c.site_id || c.site_id === siteId)
          : current

      setCartItems("cart", source, siteId, scoped)
    } catch (e) {
      console.error("Cart sync error", e)
    }
  }

  const startBuyNow = (
    item: any,
    qty: number = 1,
    returnToUrl: string,
    reservationStart?: string,
    reservationEnd?: string,
    modifiers: CartModifier[] = [],
  ) => {
    try {
      addToCartStorage(item, qty, reservationStart, reservationEnd, modifiers)
      router.push(
        `/cart/checkout?mode=cart&source=${source}${siteId ? `&siteId=${siteId}` : ""}&returnTo=${encodeURIComponent(returnToUrl)}`,
      )
    } catch (e) {
      console.error("Buy Now error", e)
    }
  }

  return { addToCartStorage, startBuyNow }
}
