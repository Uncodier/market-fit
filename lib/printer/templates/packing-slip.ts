import type { PackingSlipPayload, PaperWidthMm } from "../core/types"
import type { TicketBuilder } from "../core/ticket-builder"
import { EscPosBuilder } from "../core/escpos"
import { formatTicketTime } from "../core/format"

/** An internal fulfillment document, never a purchased carrier label. */
export function writePackingSlip(builder: TicketBuilder, payload: PackingSlipPayload): void {
  builder.bold(true).text("PACKING SLIP", "center").bold(false)
  if (payload.siteName) builder.text(payload.siteName, "center")
  if (payload.orderNumber) builder.bold(true).text(`Order #${payload.orderNumber}`).bold(false)
  builder.text(`Shipment: ${payload.shipmentId}`)
  if (payload.createdAt) builder.text(formatTicketTime(payload.createdAt, payload.locale))
  if (payload.carrier) builder.text(`Carrier: ${payload.carrier}`)
  if (payload.trackingNumber) builder.text(`Tracking: ${payload.trackingNumber}`)
  builder.separator()
  if (payload.customerName) builder.bold(true).text(payload.customerName).bold(false)
  if (payload.shippingAddress) builder.text(payload.shippingAddress)
  builder.separator()
  for (const line of payload.lines) {
    builder.bold(true).text(`${line.quantity} x ${line.name}`).bold(false)
  }
  if (payload.notes) builder.separator().text(`Notes: ${payload.notes}`)
  builder.separator().text("Internal document", "center").text("Not a carrier label", "center").cut()
}

export function encodePackingSlip(payload: PackingSlipPayload, paper: PaperWidthMm): Uint8Array {
  const builder = new EscPosBuilder(paper)
  writePackingSlip(builder, payload)
  return builder.build()
}