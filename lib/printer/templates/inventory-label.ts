import { EscPosBuilder } from "../core/escpos"
import { ticketCopy, ticketHeading } from "../core/copy"
import { formatTicketTime } from "../core/format"
import { writeBanner } from "../core/layout"
import type { TicketBuilder } from "../core/ticket-builder"
import type { InventoryLabelPayload, PaperWidthMm } from "../core/types"

export function writeInventoryLabel(b: TicketBuilder, payload: InventoryLabelPayload): void {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const paper: PaperWidthMm = b.width <= 32 ? 58 : 80
  if (payload.siteName) b.text(payload.siteName, "center")
  writeBanner(b, ticketHeading(copy.inventory, locale))
  b.size(true).bold(true)
  b.text(payload.name, "center")
  b.size(false).bold(false)
  if (payload.sku) b.text(payload.sku, "center")
  b.separator()
  if (payload.locationName) b.text(payload.locationName, "center")
  if (payload.quantity != null) b.text(`${copy.onHand}  ${payload.quantity}`, "center")
  b.text(formatTicketTime(payload.printedAt, locale), "center")
  b.feed(1)
  b.qr(payload.qrValue, paper === 58 ? 5 : 6)
  b.text(copy.traceability, "center")
  b.text(payload.qrValue, "center")
  b.cut()
}

export function encodeInventoryLabel(
  payload: InventoryLabelPayload,
  paper: PaperWidthMm,
): Uint8Array {
  const b = new EscPosBuilder(paper)
  writeInventoryLabel(b, payload)
  return b.build()
}
