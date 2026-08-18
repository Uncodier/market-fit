import { EscPosBuilder, padLine } from "../core/escpos"
import { ticketCopy, ticketHeading } from "../core/copy"
import { formatTicketTime, fulfillmentLabel } from "../core/format"
import { writeBanner, writeSolidRule } from "../core/layout"
import type { TicketBuilder } from "../core/ticket-builder"
import type { KitchenPayload, PaperWidthMm } from "../core/types"

export function writeKitchenDelta(b: TicketBuilder, payload: KitchenPayload): void {
  const delta = payload.delta
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  writeBanner(b, ticketHeading(copy.update, locale))
  if (payload.orderNumber) {
    b.size(true).bold(true)
    b.text(`#${payload.orderNumber}`, "center")
    b.size(false).bold(false)
  }
  b.text(formatTicketTime(payload.createdAt, locale), "center")
  const fulfill = fulfillmentLabel(payload.fulfillment, locale)
  if (fulfill) b.bold(true).text(ticketHeading(fulfill, locale), "center").bold(false)
  writeSolidRule(b)

  const parseItemName = (name: string) => {
    if (name.includes(' -> ')) {
      const parts = name.split(' -> ');
      return { parentName: parts[0], variantName: parts.slice(1).join(' -> ') };
    }
    return { parentName: null, variantName: name };
  }

  if (delta?.adds.length) {
    writeBanner(b, ticketHeading(copy.add, locale))
    for (const line of delta.adds) {
      b.size(true).bold(true)
      const { parentName, variantName } = parseItemName(line.name);
      
      if (parentName) {
        b.rawLine(`${line.quantity}  ${parentName}`.slice(0, b.width))
        b.size(false).bold(false)
        b.rawLine(`   ${variantName}`.slice(0, b.width))
      } else {
        b.rawLine(`${line.quantity}  ${line.name}`.slice(0, b.width))
        b.size(false).bold(false)
      }

      for (const mod of line.modifiers || []) {
        b.text(`  + ${mod.quantity}x ${mod.name}`)
      }
    }
  }

  if (delta?.qtyChanges.length) {
    writeBanner(b, ticketHeading(copy.qty, locale))
    for (const change of delta.qtyChanges) {
      b.bold(true)
      const { parentName, variantName } = parseItemName(change.name);
      if (parentName) {
        b.rawLine(padLine(parentName, `${change.from} -> ${change.to}`, b.width))
        b.bold(false)
        b.rawLine(`  ${variantName}`.slice(0, b.width))
      } else {
        b.rawLine(padLine(change.name, `${change.from} -> ${change.to}`, b.width))
        b.bold(false)
      }
    }
  }

  if (delta?.voids.length) {
    writeBanner(b, ticketHeading(copy.voidLabel, locale))
    for (const line of delta.voids) {
      const { parentName, variantName } = parseItemName(line.name);
      if (parentName) {
        b.rawLine(`${line.quantity}  ${parentName}`.slice(0, b.width))
        b.rawLine(`   ${variantName}`.slice(0, b.width))
      } else {
        b.rawLine(`${line.quantity}  ${line.name}`.slice(0, b.width))
      }
    }
  }

  if (payload.notes) {
    writeBanner(b, ticketHeading(copy.notes, locale))
    b.text(payload.notes)
  }
  b.cut()
}

export function encodeKitchenDelta(
  payload: KitchenPayload,
  paper: PaperWidthMm,
): Uint8Array {
  const b = new EscPosBuilder(paper)
  writeKitchenDelta(b, payload)
  return b.build()
}
