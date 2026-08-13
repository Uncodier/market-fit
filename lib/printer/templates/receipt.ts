import { EscPosBuilder, padLine } from "../core/escpos"
import { ticketCopy, ticketHeading } from "../core/copy"
import {
  formatMoney,
  formatTicketTime,
  fulfillmentLabel,
  paymentMethodLabel,
  receiptLineText,
} from "../core/format"
import { writeBanner, writeSolidRule } from "../core/layout"
import type { TicketBuilder } from "../core/ticket-builder"
import type { PaperWidthMm, ReceiptPayload } from "../core/types"

export function writeReceipt(b: TicketBuilder, payload: ReceiptPayload): void {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const currency = payload.currency || "USD"
  b.size(true).bold(true)
  b.text(payload.siteName || payload.title || copy.receipt, "center")
  b.size(false).bold(false)
  if (payload.address) b.text(payload.address, "center")
  if (payload.phone) b.text(payload.phone, "center")
  if (payload.website) b.text(payload.website, "center")
  if (payload.taxId) b.text(`${copy.taxId} ${payload.taxId}`, "center")
  writeSolidRule(b)
  if (payload.orderNumber) {
    b.size(true).bold(true)
    b.text(`#${payload.orderNumber}`, "center")
    b.size(false).bold(false)
  }
  b.text(formatTicketTime(payload.createdAt, locale), "center")
  const fulfill = fulfillmentLabel(payload.fulfillment, locale)
  if (fulfill) {
    b.bold(true).text(ticketHeading(fulfill, locale), "center").bold(false)
  }
  if (payload.customerName) b.rawLine(padLine(copy.customer, payload.customerName, b.width))
  if (payload.locationName) b.rawLine(padLine(copy.location, payload.locationName, b.width))
  if (payload.cashierName) b.rawLine(padLine(copy.cashier, payload.cashierName, b.width))
  b.separator()
  for (const line of receiptLineText(payload, b.width)) {
    b.rawLine(line)
  }
  writeSolidRule(b)
  if (payload.subtotal != null) {
    b.rawLine(padLine(copy.subtotal, formatMoney(payload.subtotal, currency, locale), b.width))
  }
  if (payload.discountTotal) {
    b.rawLine(
      padLine(copy.discount, `-${formatMoney(payload.discountTotal, currency, locale)}`, b.width),
    )
  }
  if (payload.taxTotal) {
    b.rawLine(padLine(copy.tax, formatMoney(payload.taxTotal, currency, locale), b.width))
  }
  b.bold(true)
  b.rawLine(
    padLine(ticketHeading(copy.total, locale), formatMoney(payload.total ?? 0, currency, locale), b.width),
  )
  b.bold(false)
  for (const pay of payload.payments || []) {
    b.rawLine(
      padLine(
        paymentMethodLabel(pay.method, locale),
        formatMoney(pay.amount, currency, locale),
        b.width,
      ),
    )
    if (pay.change && pay.change > 0) {
      b.rawLine(padLine(copy.change, formatMoney(pay.change, currency, locale), b.width))
    }
  }
  if (payload.notes) {
    b.separator()
    writeBanner(b, ticketHeading(copy.notes, locale))
    b.text(payload.notes)
  }
  const qr = payload.qrValue || payload.orderNumber
  if (qr) {
    b.feed(1)
    b.qr(qr, b.width <= 32 ? 4 : 5)
    b.text(copy.order, "center")
  }
  b.feed(1)
  b.bold(true).text(copy.thankYou, "center").bold(false)
  if (payload.website) b.text(payload.website, "center")
  b.cut()
}

export function encodeReceipt(
  payload: ReceiptPayload,
  paper: PaperWidthMm,
): Uint8Array {
  const b = new EscPosBuilder(paper)
  writeReceipt(b, payload)
  return b.build()
}
