import type { TicketBuilder } from "./ticket-builder"

export function padCenter(text: string, width: number): string {
  const clipped = String(text || "").slice(0, width)
  const pad = Math.max(0, width - clipped.length)
  const left = Math.floor(pad / 2)
  return `${" ".repeat(left)}${clipped}${" ".repeat(pad - left)}`
}

export function writeBanner(b: TicketBuilder, label: string): void {
  const cols = Math.max(8, Math.floor(b.width / 2))
  b.size(true, true).invert(true).bold(true)
  b.rawLine(padCenter(` ${String(label || "").trim()} `, cols))
  b.invert(false).bold(false).size(false)
}

export function writeSolidRule(b: TicketBuilder): void {
  b.blackBar(4)
}
