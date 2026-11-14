"use client"

import { useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "../cart-types"
import { cartLineKey, cartWithQty, cartWithQtyDelta, mergeItemIntoCart } from "../cart-line-utils"
import {
  annotatePosCartInventory, posCartInventoryError, posCatalogItemAvailability,
  type PosCartInventoryContext,
} from "../cart-availability"
import { completePosStockAddition, findPosStockShortage } from "../stock-shortage"

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
  const [shortage, setShortage] = useState<{
    id: string; item: CatalogItem; quantity: number; next: PosCartItem[]; previous: PosCartItem[];
    context: PosCartInventoryContext
  } | null>(null)
  useLayoutEffect(() => {
    cartRef.current = cart
    contextRef.current = context
  }, [cart, context])

  const commit = (next: PosCartItem[], confirmed = false) => {
    const previous = cartRef.current
    const currentContext = contextRef.current
    const shortage = !confirmed && findPosStockShortage(next, previous, currentContext)
    if (shortage) {
      setShortage({ ...shortage, id: uuidv4(), next, previous, context: currentContext })
      return false
    }
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
    if (line && (line.completedWithoutStock || (line.inventoryCompletedQty || 0) > 0
      || line.modifiers?.some((modifier) => (modifier.inventoryCompletedQty || 0) > 0)) && quantity > line.cartQty) {
      commit([...cartRef.current, { ...line, lineKey: uuidv4(), cartQty: quantity - line.cartQty,
        completedWithoutStock: false, inventoryCompletedQty: undefined, saleOrderItemId: undefined,
        modifiers: line.modifiers?.map((modifier) => ({ ...modifier,
          inventoryCompletedQty: undefined, saleOrderItemId: undefined,
        })),
      }])
      return
    }
    commit(cartWithQty(cartRef.current, id, quantity))
  }

  return {
    displayCart,
    shortage,
    dismissShortage: () => setShortage(null),
    completeShortage: () => {
      if (!shortage) return
      if (shortage.previous !== cartRef.current || JSON.stringify(shortage.context) !== JSON.stringify(contextRef.current)) {
        setShortage(null)
        toast.error("The cart or stock changed. Add the item again to review availability.")
        return
      }
      const completed = completePosStockAddition(shortage.next, shortage.previous)
      if (commit(completed, true)) setSelectedCartItemId(cartLineKey(completed.find((line) => line.completedWithoutStock)!))
      setShortage(null)
    },
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
      if (delta > 0 && line) {
        setItemQty(id, line.cartQty + delta)
        return
      }
      commit(cartWithQtyDelta(cartRef.current, id, delta))
    },
  }
}