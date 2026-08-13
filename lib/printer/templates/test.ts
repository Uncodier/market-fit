import { EscPosBuilder, padLine } from "../core/escpos"
import { ticketCopy, ticketHeading } from "../core/copy"
import { formatTicketTime } from "../core/format"
import { writeBanner } from "../core/layout"
import type { TicketBuilder } from "../core/ticket-builder"
import type { PaperWidthMm, TestPrintPayload } from "../core/types"

export function writeTestPrint(b: TicketBuilder, payload: TestPrintPayload): void {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const paper: PaperWidthMm = b.width <= 32 ? 58 : 80
  writeBanner(b, ticketHeading(payload.title || copy.stationSynced, locale))
  b.feed(1)
  b.size(true).bold(true)
  b.text(payload.printerName || copy.testPrint, "center")
  b.size(false).bold(false)
  b.text(copy.syncLinked, "center")
  b.separator()
  if (payload.stationName) {
    b.rawLine(padLine(copy.computer, payload.stationName, b.width))
  }
  if (payload.hardwareName) {
    b.rawLine(padLine(copy.device, payload.hardwareName, b.width))
  }
  b.rawLine(padLine(copy.paper, `${paper} mm`, b.width))
  b.separator()
  b.text(formatTicketTime(undefined, locale), "center")
  b.feed(1)
  b.bold(true)
  b.text(copy.readyToPrint, "center")
  b.bold(false)
  b.cut()
}

export function encodeTestPrint(
  payload: TestPrintPayload,
  paper: PaperWidthMm,
): Uint8Array {
  const b = new EscPosBuilder(paper)
  writeTestPrint(b, payload)
  return b.build()
}
