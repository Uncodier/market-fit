"use client"

import { useLayoutEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "../cart-types"
import { cartLineKey, cartWithQty, cartWithQtyDelta, mergeItemIntoCart } from "../cart-line-utils"
import {
  annotatePosCartInventory, posCartInventoryError, posCatalogItemAvailability,
  type PosCartInventoryContext,
} from "../cart-availability"

type Args = PosCartInventoryContext & {
  cart: PosCartItem[]
  setCart: Dispatch<SetStateAction<PosCartItem[]>>
  setSelectedCartItemId: Dispatch<SetStateAction<string | null>>
  resolvePrice: (item: CatalogItem) => number
}

export function usePosInventoryCart({
  cart, setCart, setSelectedCartItemId, resolvePrice,
  catalogItems, inventorySnapshot, originLocationId,
}: Args) {
  const context = useMemo(() => ({ catalogItems, inventorySnapshot, originLocationId }),
    [catalogItems, inventorySnapshot, originLocationId])
  const displayCart = useMemo(() => annotatePosCartInventory(cart, context), [cart, context])
  const cartRef = useRef(cart)
  const contextRef = useRef(context)
  useLayoutEffect(() => {
    cartRef.current = cart
    contextRef.current = context
  }, [cart, context])

  const commit = (next: PosCartItem[]) => {
    const previous = cartRef.current
    const currentContext = contextRef.current
    const error = posCartInventoryError(next, currentContext, previous)
    if (error) {
      toast.error(error)
      return false
    }
    const annotated = annotatePosCartInventory(next, currentContext)
    const previousBackorders = annotatePosCartInventory(previous, currentContext)
      .reduce((sum, line) => sum + (line.backorderQty || 0)
        + (line.modifiers || []).reduce((total, modifier) => total + (modifier.backorderQty || 0), 0), 0)
    const nextBackorders = annotated.reduce((sum, line) => sum + (line.backorderQty || 0)
      + (line.modifiers || []).reduce((total, modifier) => total + (modifier.backorderQty || 0), 0), 0)
    if (nextBackorders > previousBackorders) {
      toast.warning("Insufficient stock. The unavailable quantity has been added as a backorder.")
    }
    cartRef.current = next
    setCart(next)
    return true
  }

  const setItemQty = (id: string, quantity: number) => {
    const line = cartRef.current.find((item) => cartLineKey(item) === id)
    if (line?.reservationStart && quantity > line.cartQty
      && quantity > (line.reservationAvailableQty || 1)) {
      toast.error("The requested quantity exceeds the available reservation capacity.")
      return
    }
    commit(cartWithQty(cartRef.current, id, quantity))
  }

  return {
    displayCart,
    getItemAvailability: (item: CatalogItem) => posCatalogItemAvailability(item, cart, context),
    validateInventory: () => {
      const error = posCartInventoryError(cartRef.current, contextRef.current)
      if (error) toast.error(error)
      return !error
    },
    addItemToCart: (item: CatalogItem, extras?: Partial<PosCartItem>) => {
      const merged = mergeItemIntoCart(cartRef.current, item, extras, resolvePrice)
      if (commit(merged.next)) setSelectedCartItemId(merged.lineKey)
    },
    setItemQty,
    updateQty: (id: string, delta: number) => {
      const line = cartRef.current.find((item) => cartLineKey(item) === id)
      if (delta > 0 && line?.reservationStart) {
        setItemQty(id, line.cartQty + delta)
        return
      }
      commit(cartWithQtyDelta(cartRef.current, id, delta))
    },
  }
}