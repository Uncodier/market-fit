"use client"

import { useState } from "react"
import { toast } from "sonner"
import { getOrder } from "@/app/orders/actions"
import {
  buildOrderPrintTicket,
  type OrderPrintMode,
} from "@/app/orders/order-printing"
import type { OrderWithRelations } from "@/app/orders/types"
import { markKitchenItemsPrinted } from "@/app/printer/actions"
import { usePrinter } from "@/lib/printer/hooks/use-printer"
import { providerAccepted, providerCancellationConfirmed } from "@/lib/marketplace/presentation"
import { cancellationOnlyDelta } from "@/lib/printer/core/marketplace-printing"
import {
  bluetoothErrorMessage,
  kitchenDeltaHasWork,
  ticketBrandFromSite,
  type KitchenPayload,
} from "@/lib/printer"

type UseOrderPrintingArgs = {
  siteId?: string
  site?: Parameters<typeof ticketBrandFromSite>[0]
}

export function useOrderPrinting({ siteId, site }: UseOrderPrintingArgs) {
  const { printJob } = usePrinter()
  const [printingKey, setPrintingKey] = useState<string | null>(null)

  const printOrder = async (
    listedOrder: OrderWithRelations,
    mode: OrderPrintMode,
  ) => {
    if (!siteId) return
    const key = `${listedOrder.id}:${mode}`
    setPrintingKey(key)

    try {
      const result = await getOrder(listedOrder.id)
      if (result.error || !result.data) {
        throw new Error(result.error || "Order could not be loaded")
      }
      if (result.data.site_id !== siteId) {
        throw new Error("Order does not belong to the current site")
      }
      const cancellation = mode === "delta" && providerCancellationConfirmed(result.data.metadata)
      if (!providerAccepted(result.data.metadata) && !cancellation) {
        throw new Error("Wait for provider acceptance before printing this order")
      }

      const ticket = buildOrderPrintTicket(
        cancellation
          ? (result.data.sale_order_items || []).map(item => ({ ...item, status: "cancelled" }))
          : result.data.sale_order_items || [],
        mode,
      )
      if (cancellation) {
        ticket.delta = cancellationOnlyDelta(ticket.delta)
        ticket.lines = []
        const voidIds = new Set(ticket.delta.voids.map(line => line.itemId))
        ticket.printedItems = ticket.printedItems.filter(item => voidIds.has(item.id) && item.quantity === 0)
      }
      if (!kitchenDeltaHasWork(ticket.delta)) {
        toast.message(
          mode === "delta"
            ? "There are no order changes to print"
            : "There are no order items to print",
        )
        return
      }

      const sentAt = new Date().toISOString()
      const payload: KitchenPayload = {
        ...ticketBrandFromSite(site),
        orderNumber: result.data.order_number,
        createdAt: result.data.created_at,
        fulfillment: result.data.fulfillment_method,
        customerName: result.data.leads?.name || null,
        requestedByName:
          result.data.requested_by?.name ||
          result.data.seller?.name ||
          result.data.created_by?.name ||
          null,
        notes: result.data.notes,
        lines: ticket.lines,
        delta: ticket.delta,
      }

      await printJob({
        module: "orders",
        template: mode === "full" ? "kitchen" : "kitchen-delta",
        orderId: result.data.id,
        sentAt,
        payload,
      })

      if (ticket.printedItems.length > 0) {
        const markResult = await markKitchenItemsPrinted(
          siteId,
          ticket.printedItems,
        )
        if (markResult.error) {
          toast.warning("The ticket printed, but print history was not saved")
        }
      }
      toast.success(
        mode === "full" ? "Order printed" : "Order changes printed",
      )
    } catch (error) {
      toast.error(
        bluetoothErrorMessage(error) ||
          (error instanceof Error ? error.message : "Order could not be printed"),
      )
    } finally {
      setPrintingKey(null)
    }
  }

  return { printingKey, printOrder }
}
