"use client"

import { useSyncExternalStore } from "react"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { hasPendingReceipt, pendingReceiptChangedEvent } from "./pending-receipt"

function subscribe(onChange: () => void) {
  window.addEventListener(pendingReceiptChangedEvent, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(pendingReceiptChangedEvent, onChange)
    window.removeEventListener("storage", onChange)
  }
}

// Storage only exposes recovery. It never authorizes or automatically replays a receipt.
export function usePendingReceipt(siteId: string | undefined, purchaseId: string | undefined) {
  const { user } = useAuthContext()
  const actorId = user?.id
  const pending = useSyncExternalStore(subscribe,
    () => hasPendingReceipt(actorId, siteId, purchaseId), () => false)
  return { pending, actorId }
}
