import type { PosCartItem } from "@/app/pos/components/CartPanel"
import { markKitchenItemsPrinted } from "@/app/printer/actions"
import {
  kitchenDeltaHasWork,
  printJobForSettings,
  rememberPrinted,
  shouldAutoPrint,
  type KitchenDelta,
  type PrintersSettings,
  type ReceiptPayload,
  type TicketBrand,
} from "@/lib/printer"

export function receiptFromPosCart(params: {
  cart: PosCartItem[]
  total: number
  payments?: { method: string; amount: number; tendered?: number; change?: number }[]
  notes?: string
  brand?: TicketBrand
  customerName?: string | null
  cashierName?: string | null
  fulfillment?: string | null
  locationName?: string | null
  currency?: string | null
  subtotal?: number | null
  taxTotal?: number | null
  discountTotal?: number | null
}): ReceiptPayload {
  const lines = params.cart
    .filter((c) => c.cartQty > 0)
    .map((c) => ({
      name: c.name,
      quantity: c.cartQty,
      unitPrice: c.cartPrice,
      subtotal: c.cartPrice * c.cartQty,
      modifiers: (c.modifiers || []).map((m) => ({
        name: m.name,
        quantity: m.cartQty,
      })),
    }))
  const lineSubtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  return {
    ...params.brand,
    siteName: params.brand?.siteName,
    lines,
    total: params.total,
    subtotal: params.subtotal ?? lineSubtotal,
    taxTotal: params.taxTotal,
    discountTotal: params.discountTotal,
    payments: params.payments,
    notes: params.notes || null,
    customerName: params.customerName || null,
    cashierName: params.cashierName || null,
    fulfillment: params.fulfillment || null,
    locationName: params.locationName || null,
    currency: params.currency || "USD",
  }
}

export async function printAfterPosCheckout(params: {
  settings: PrintersSettings
  siteId?: string
  intent: "complete" | "pay" | "send"
  orderId?: string | null
  orderNumber?: string | null
  createdAt?: string | null
  fulfillment?: string | null
  kitchenDelta?: KitchenDelta | null
  receipt: ReceiptPayload
}): Promise<void> {
  const { settings, intent, orderId, kitchenDelta, receipt } = params
  const sentAt = new Date().toISOString()
  receipt.orderNumber = params.orderNumber || receipt.orderNumber
  receipt.createdAt = params.createdAt || receipt.createdAt
  receipt.qrValue = receipt.qrValue || params.orderNumber || orderId || null
  if (params.fulfillment && !receipt.fulfillment) receipt.fulfillment = params.fulfillment
  const autoOpts = { fallbackToSystem: false, allowPrompt: false }

  const printReceipt =
    (intent === "pay" || intent === "complete" || (intent === "send" && (receipt.payments || []).length > 0)) &&
    shouldAutoPrint(settings, "pos", "posReceipt")

  if (printReceipt) {
    await printJobForSettings(
      settings,
      {
        id: `receipt-${orderId || sentAt}`,
        module: "pos",
        template: "receipt",
        orderId: orderId || undefined,
        sentAt,
        payload: receipt,
      },
      { ...autoOpts, autoPrintFlag: "posReceipt" },
    )
  }

  if (intent !== "send" || !kitchenDelta || !kitchenDeltaHasWork(kitchenDelta)) return

  const isFull = kitchenDelta.kind === "full"
  const flag = isFull ? "kitchenTicket" : "orderDelta"
  if (!shouldAutoPrint(settings, "orders", flag)) return

  const job = {
    id: `kitchen-${orderId || sentAt}`,
    module: "orders" as const,
    template: (isFull ? "kitchen" : "kitchen-delta") as const,
    orderId: orderId || undefined,
    sentAt,
    payload: {
      siteName: receipt.siteName,
      logoUrl: receipt.logoUrl,
      orderNumber: params.orderNumber,
      createdAt: params.createdAt || sentAt,
      fulfillment: params.fulfillment || receipt.fulfillment,
      customerName: receipt.customerName,
      notes: receipt.notes,
      lines: kitchenDelta.adds,
      delta: kitchenDelta,
    },
  }
  const printedOk = await printJobForSettings(settings, job, {
    ...autoOpts,
    autoPrintFlag: flag,
  })
  if (!printedOk) return
  rememberPrinted(job)

  if (!params.siteId) return
  const printed = [
    ...kitchenDelta.adds
      .filter((line) => line.itemId)
      .map((line) => ({ id: line.itemId as string, quantity: line.quantity })),
    ...kitchenDelta.qtyChanges
      .filter((change) => change.itemId)
      .map((change) => ({ id: change.itemId as string, quantity: change.to })),
  ]
  if (printed.length) {
    void markKitchenItemsPrinted(params.siteId, printed)
  }
}
