import { EscPosBuilder } from "../core/escpos"
import { ticketCopy, ticketHeading } from "../core/copy"
import { formatTicketTime, fulfillmentLabel } from "../core/format"
import { writeBanner, writeSolidRule } from "../core/layout"
import type { TicketBuilder } from "../core/ticket-builder"
import type { KitchenPayload, PaperWidthMm } from "../core/types"

export function writeKitchenTicket(b: TicketBuilder, payload: KitchenPayload): void {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  writeBanner(b, ticketHeading(copy.kitchen, locale))
  if (payload.orderNumber) {
    b.size(true).bold(true)
    b.text(`#${payload.orderNumber}`, "center")
    b.size(false).bold(false)
  }
  b.text(formatTicketTime(payload.createdAt, locale), "center")
  const fulfill = fulfillmentLabel(payload.fulfillment, locale)
  if (fulfill) b.bold(true).text(ticketHeading(fulfill, locale), "center").bold(false)
  if (payload.tableName) b.rawLine(padKv(copy.table, payload.tableName, b.width))
  if (payload.customerName) b.rawLine(padKv(copy.customer, payload.customerName, b.width))
  writeSolidRule(b)
  for (const line of payload.lines || []) {
    b.size(true).bold(true)
    b.rawLine(`${line.quantity}  ${line.name}`.slice(0, b.width))
    b.size(false).bold(false)
    for (const mod of line.modifiers || []) {
      b.text(`  + ${mod.quantity}x ${mod.name}`)
    }
    if (line.notes) b.text(`  ${line.notes}`)
  }
  if (payload.notes) {
    writeBanner(b, ticketHeading(copy.notes, locale))
    b.text(payload.notes)
  }
  b.cut()
}

function padKv(label: string, value: string, width: number): string {
  const gap = width - label.length - value.length
  if (gap <= 0) return `${label} ${value}`.slice(0, width)
  return `${label}${" ".repeat(gap)}${value}`
}

export function encodeKitchenTicket(
  payload: KitchenPayload,
  paper: PaperWidthMm,
): Uint8Array {
  const b = new EscPosBuilder(paper)
  writeKitchenTicket(b, payload)
  return b.build()
}
