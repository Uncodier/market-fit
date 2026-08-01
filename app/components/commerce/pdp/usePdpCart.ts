"use client"

import { usePathname, useRouter } from "next/navigation"
import { setCartItems, getCartItems } from "@/app/commerce/cart-storage"

export const usePdpCart = (siteId: string) => {
  const pathname = usePathname()
  const router = useRouter()
  const isMarketplace = pathname?.startsWith('/marketplace')
  const source = isMarketplace ? 'marketplace' : 'shop'
  
  const addToCartStorage = (item: any, qty: number = 1, reservationStart?: string, reservationEnd?: string) => {
    try {
      const current = getCartItems('cart', source, siteId)
      
      const existingIdx = current.findIndex((c: any) => 
        c.id === item.id && c.reservationStart === reservationStart
      );
      
      if (existingIdx >= 0) {
        current[existingIdx].cartQty += qty;
      } else {
        current.push({
          ...item,
          cartQty: qty,
          cartPrice: item.target_sale_price || 0,
          currency: item.currency || 'USD',
          reservationStart,
          reservationEnd
        });
      }
      
      setCartItems('cart', source, siteId, current)
    } catch (e) {
      console.error('Cart sync error', e);
    }
  };

  const startBuyNow = (item: any, qty: number = 1, returnToUrl: string, reservationStart?: string, reservationEnd?: string) => {
    try {
      const buyNowItem = {
        ...item,
        cartQty: qty,
        cartPrice: item.target_sale_price || 0,
        currency: item.currency || 'USD',
        reservationStart,
        reservationEnd
      }
      setCartItems('buynow', source, siteId, [buyNowItem])
      router.push(`/cart/checkout?mode=buynow&source=${source}${siteId ? `&siteId=${siteId}` : ''}&returnTo=${encodeURIComponent(returnToUrl)}`)
    } catch (e) {
      console.error('Buy Now error', e)
    }
  }

  return { addToCartStorage, startBuyNow };
}