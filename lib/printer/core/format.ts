import type {
  KitchenLine,
  KitchenPayload,
  PaperWidthMm,
  PrinterDevice,
  PrinterModule,
  PrintersSettings,
  ReceiptPayload,
} from "./types"
import { charsPerLine } from "./types"
import { ticketCopy, ticketLocaleTag } from "./copy"
import { padLine } from "./escpos"

export function printersForModule(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
): PrinterDevice[] {
  return (settings?.devices || []).filter((d) => d.enabled !== false && d.modules[module])
}

export function printersForAutoPrint(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
  flag: keyof PrinterDevice["autoPrint"],
): PrinterDevice[] {
  return printersForModule(settings, module).filter((d) => d.autoPrint[flag])
}

export function printersForJob(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
  template: string,
  autoPrintFlag?: keyof PrinterDevice["autoPrint"],
): PrinterDevice[] {
  if (!autoPrintFlag) return printersForModule(settings, module)
  const flagged = printersForAutoPrint(settings, module, autoPrintFlag)
  if (flagged.length > 0) return flagged
  if (template === "kitchen" || template === "kitchen-delta") {
    return printersForModule(settings, "orders")
  }
  return []
}

export function formatMoney(
  amount: number | null | undefined,
  currency = "USD",
  locale?: string | null,
): string {
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat(ticketLocaleTag(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

export function formatTicketTime(iso?: string | null, locale?: string | null): string {
  const { date, time } = formatTicketDateParts(iso, locale)
  return `${date}  ${time}`
}

export function formatTicketDateParts(
  iso?: string | null,
  locale?: string | null,
): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return { date: String(iso || ""), time: "" }
  const tag = ticketLocaleTag(locale)
  return {
    date: d.toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }),
  }
}

export function fulfillmentLabel(value?: string | null, locale?: string | null): string {
  const copy = ticketCopy(locale)
  const key = String(value || "").toLowerCase()
  if (key === "dine_in" || key === "dine-in") return copy.dineIn
  if (key === "pickup") return copy.pickup
  if (key === "ship" || key === "delivery") return copy.delivery
  if (key === "none") return ""
  return value ? value.replace(/_/g, " ") : ""
}

export function paymentMethodLabel(value?: string | null, locale?: string | null): string {
  const copy = ticketCopy(locale)
  const key = String(value || "").toLowerCase()
  if (key === "cash") return copy.cash
  if (key === "card") return copy.card
  if (key === "transfer" || key === "bank_transfer") return copy.transfer
  if (key === "other") return copy.other
  return value ? value.replace(/_/g, " ") : copy.payment
}

export function kitchenLineText(line: KitchenLine, width: number): string[] {
  const qty = `${line.quantity}x`
  const rows = [padLine(qty, line.name, width)]
  for (const mod of line.modifiers || []) {
    rows.push(`   + ${mod.quantity}x ${mod.name}`.slice(0, width))
  }
  if (line.notes) rows.push(`   ${line.notes}`.slice(0, width))
  return rows
}

export function receiptLineText(
  payload: ReceiptPayload,
  width: number,
): string[] {
  const currency = payload.currency || "USD"
  const rows: string[] = []
  for (const line of payload.lines) {
    rows.push(
      padLine(
        `${line.quantity}x ${line.name}`,
        formatMoney(line.subtotal, currency, payload.locale),
        width,
      ),
    )
    for (const mod of line.modifiers || []) {
      rows.push(`  + ${mod.quantity}x ${mod.name}`.slice(0, width))
    }
  }
  return rows
}

export function ticketWidth(paper: PaperWidthMm): number {
  return charsPerLine(paper)
}

export function dashedRule(paper: PaperWidthMm): string {
  return rule(charsPerLine(paper))
}

export function kitchenLinesFromPayload(payload: KitchenPayload): KitchenLine[] {
  if (payload.delta?.kind === "full") return payload.delta.adds
  return payload.lines
}
