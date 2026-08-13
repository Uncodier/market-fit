"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { getOrder } from "@/app/orders/actions"
import {
  autoPrintFlagForJob,
  bluetoothErrorMessage,
  computeKitchenDelta,
  kitchenDeltaHasWork,
  mapSaleOrderItemsToDeltaLines,
  printerJobQueue,
  printJobForSettings,
  printersForModule,
  shouldAutoPrint,
  wasPrinted,
  type KitchenPayload,
  type PrintersSettings,
  type TicketBrand,
} from "@/lib/printer"
import { markKitchenItemsPrinted } from "@/app/printer/actions"

const PRINT_DEBOUNCE_MS = 400
const ORDER_RETRY_ATTEMPTS = 4
const ORDER_RETRY_MS = 300

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadOrderForPrint(orderId: string) {
  let order: Awaited<ReturnType<typeof getOrder>>["data"] = undefined
  for (let attempt = 0; attempt < ORDER_RETRY_ATTEMPTS; attempt++) {
    const res = await getOrder(orderId)
    order = res.data
    if (order?.sale_order_items?.length) return order
    if (attempt < ORDER_RETRY_ATTEMPTS - 1) await wait(ORDER_RETRY_MS)
  }
  return order
}

type RealtimePayload = {
  eventType?: string
  table?: string
  new?: { id?: string; sale_order_id?: string; status?: string }
}

function snapshotKey(orderId: string) {
  return `makinari-kitchen-snap:${orderId}`
}

function loadSnapshot(orderId: string) {
  if (typeof sessionStorage === "undefined") return []
  try {
    const raw = sessionStorage.getItem(snapshotKey(orderId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSnapshot(orderId: string, items: unknown[]) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(snapshotKey(orderId), JSON.stringify(items))
}

function orderIdFromPayload(payload: RealtimePayload): string | undefined {
  return payload.table === "sale_orders" ? payload.new?.id : payload.new?.sale_order_id
}

export function usePrinterRealtime(
  siteId: string | undefined,
  settings: PrintersSettings,
  brand?: TicketBrand,
) {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const brandRef = useRef(brand)
  brandRef.current = brand
  const siteIdRef = useRef(siteId)
  siteIdRef.current = siteId

  useEffect(() => {
    printerJobQueue.setHandler(async (job) => {
      try {
        const flag = autoPrintFlagForJob(job)
        const ok = await printJobForSettings(settingsRef.current, job, {
          autoPrintFlag: flag,
          fallbackToSystem: false,
          allowPrompt: false,
        })
        if (!ok) {
          throw new Error("No printer is ready on this station")
        }
      } catch (err) {
        toast.error(
          bluetoothErrorMessage(err) ||
            (err instanceof Error ? err.message : "Kitchen ticket did not print"),
          { id: "printer-job-failed" },
        )
        throw err
      }
      const delta = (job.payload as KitchenPayload).delta
      const currentSiteId = siteIdRef.current
      if (!delta || !currentSiteId) return
      const printed = [
        ...delta.adds
          .filter((line) => line.itemId)
          .map((line) => ({ id: line.itemId as string, quantity: line.quantity })),
        ...delta.qtyChanges
          .filter((change) => change.itemId)
          .map((change) => ({ id: change.itemId as string, quantity: change.to })),
      ]
      if (printed.length) {
        void markKitchenItemsPrinted(currentSiteId, printed)
      }
    })
  }, [settings])

  useEffect(() => {
    if (!siteId) return

    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const processOrder = async (orderId: string) => {
      const current = settingsRef.current
      const autoKitchen =
        shouldAutoPrint(current, "orders", "kitchenTicket") ||
        printersForModule(current, "orders").length > 0
      const autoDelta = shouldAutoPrint(current, "orders", "orderDelta")
      if (!autoKitchen && !autoDelta) return

      try {
        const order = await loadOrderForPrint(orderId)
        if (!order) return
        const rawItems = order.sale_order_items || []
        if (rawItems.length === 0) return
        const items = mapSaleOrderItemsToDeltaLines(rawItems)
        const previous = mapSaleOrderItemsToDeltaLines(loadSnapshot(orderId) || [])
        const delta = computeKitchenDelta(previous, items)

        const usable =
          delta.kind === "full"
            ? autoKitchen && delta.adds.length > 0
            : autoDelta && kitchenDeltaHasWork(delta) && delta.kind === "delta"

        if (!usable) {
          saveSnapshot(orderId, rawItems)
          return
        }

        const sentAt = new Date().toISOString()
        const job = {
          id: `${orderId}:${delta.kind}:${sentAt}`,
          module: "orders" as const,
          template: (delta.kind === "full" ? "kitchen" : "kitchen-delta") as const,
          orderId,
          sentAt,
          payload: {
            ...brandRef.current,
            orderNumber: order.order_number,
            createdAt: order.created_at,
            fulfillment: order.fulfillment_method,
            notes: order.notes,
            lines: delta.kind === "full" ? delta.adds : items.filter((i) => !i.isModifier),
            delta,
          } satisfies KitchenPayload,
        }
        if (wasPrinted(job)) {
          saveSnapshot(orderId, order.sale_order_items || [])
          return
        }
        printerJobQueue.enqueue(job)
        saveSnapshot(orderId, order.sale_order_items || [])
      } catch (err) {
        console.warn("[printer] realtime print failed", err)
        toast.error(
          bluetoothErrorMessage(err) ||
            (err instanceof Error ? err.message : "Kitchen ticket did not print"),
        )
      }
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<RealtimePayload>).detail
      if (!detail) return
      const orderId = orderIdFromPayload(detail)
      if (!orderId) return
      const existing = timers.get(orderId)
      if (existing) clearTimeout(existing)
      timers.set(
        orderId,
        setTimeout(() => {
          timers.delete(orderId)
          void processOrder(orderId)
        }, PRINT_DEBOUNCE_MS),
      )
    }

    window.addEventListener("printer:order-event", handler as EventListener)
    return () => {
      window.removeEventListener("printer:order-event", handler as EventListener)
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [siteId])
}
