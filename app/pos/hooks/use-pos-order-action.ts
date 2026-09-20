"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type PosOrderAction = "pay" | "split"

type UsePosOrderActionArgs = {
  siteId?: string
  sessionReady: boolean
  catalogHydrated: boolean
  activeOrderId: string
  cartLength: number
  loadingOrder: boolean
  handleOrderSelect: (orderId: string) => Promise<boolean>
  initiateCheckout: () => void
  openSplitDialog: () => void
}

export function usePosOrderAction({
  siteId,
  sessionReady,
  catalogHydrated,
  activeOrderId,
  cartLength,
  loadingOrder,
  handleOrderSelect,
  initiateCheckout,
  openSplitDialog,
}: UsePosOrderActionArgs) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRequestRef = useRef<string | null>(null)
  const [pending, setPending] = useState<{
    orderId: string
    action: PosOrderAction
  } | null>(null)

  useEffect(() => {
    const orderId = searchParams.get("orderId")
    const action = searchParams.get("action")
    if (!orderId || (action !== "pay" && action !== "split")) return
    if (!siteId || !sessionReady || !catalogHydrated) return

    const requestKey = `${orderId}:${action}`
    if (handledRequestRef.current === requestKey) return
    handledRequestRef.current = requestKey

    void handleOrderSelect(orderId).then((loaded) => {
      if (loaded) setPending({ orderId, action })
      else router.replace("/pos", { scroll: false })
    })
  }, [
    searchParams,
    siteId,
    sessionReady,
    catalogHydrated,
    handleOrderSelect,
    router,
  ])

  useEffect(() => {
    if (
      !pending ||
      loadingOrder ||
      activeOrderId !== pending.orderId ||
      cartLength === 0
    ) {
      return
    }

    const action = pending.action
    setPending(null)
    router.replace("/pos", { scroll: false })
    if (action === "pay") initiateCheckout()
    else openSplitDialog()
  }, [
    pending,
    loadingOrder,
    activeOrderId,
    cartLength,
    initiateCheckout,
    openSplitDialog,
    router,
  ])
}
