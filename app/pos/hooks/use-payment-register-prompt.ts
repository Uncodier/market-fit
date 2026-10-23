"use client"

import { useState } from "react"
import { getCheckoutCartSession } from "../local/checkout-attempt-storage"

/** Register setup belongs to the current checkout, not to another cart or actor. */
export function usePaymentRegisterPrompt(siteId: string | undefined, userId: string | undefined, orderId: string, cartKey: string) {
  const [scope, setScope] = useState<{ siteId: string; userId?: string; orderId: string; cartKey: string; session: string } | null>(null)
  return {
    open: !!siteId && scope?.siteId === siteId && scope.userId === userId &&
      scope.orderId === orderId && scope.cartKey === cartKey && scope.session === getCheckoutCartSession(siteId),
    setOpen(open: boolean) {
      setScope(open && siteId ? { siteId, userId, orderId, cartKey, session: getCheckoutCartSession(siteId) } : null)
    },
  }
}