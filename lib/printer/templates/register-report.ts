import { EscPosBuilder } from "../core/escpos"
import { registerReportSummary } from "../core/register-report"
import type { TicketBuilder } from "../core/ticket-builder"
import type { PaperWidthMm, RegisterReportPayload } from "../core/types"
import { registerMoney } from "@/app/pos/register/register-ui-utils"

type ReportSection = { title: string; lines: string[] }

function reportSections(payload: RegisterReportPayload): ReportSection[] {
  const { session, locationName } = payload
  const summary = registerReportSummary(payload)
  // Preserve the recorded timestamp, including offset and fractional seconds.
  const registerDate = (value: string | null) => value || "—"
  const money = (amount: number | null) => amount === null ? "—" : registerMoney(amount, session.currency)
  const sections: ReportSection[] = [
    { title: "Cash Register Report", lines: [
      session.status === "closed" ? "Immutable closing snapshot" : "Live session preview — not a closing report",
      `Location: ${locationName}`, `Location ID: ${session.location_id}`, `Site ID: ${session.site_id}`,
      `Session: ${session.id}`, `Currency: ${session.currency}`, `Status: ${session.status}`,
      `Opened: ${registerDate(session.opened_at)}`, `Responsible (user ID): ${session.opened_by}`,
      `Closed: ${registerDate(session.closed_at)}`, `Closed by (user ID): ${session.closed_by || "—"}`,
    ] },
    { title: "Reconciliation", lines: [
      `Opening cash: ${money(summary.opening_amount)}`, `Cash received: ${money(summary.cash_received)}`,
      `Cash in: ${money(summary.cash_in)}`, `Cash out: ${money(summary.cash_out)}`,
      `Cash refunds: ${money(summary.cash_refunds)}`, `Expected drawer cash: ${money(summary.expected_amount)}`,
      `Counted cash: ${money(session.counted_amount)}`, `Closing difference: ${money(session.difference)}`,
      `Total received (all methods): ${money(summary.total_received)}`, `Receipt count: ${summary.receipt_count}`,
      "Expected cash = opening + cash received + cash in - cash out - cash refunds. Non-cash payments do not change expected drawer cash.",
      "Only receipts recorded with this register feature are included. Historical sales are not reconstructed.",
      ...(session.notes ? [`Closing notes: ${session.notes}`] : []),
    ] },
    { title: "Payment totals", lines: Object.entries(summary.payment_totals).map(
      ([method, amount]) => `${method}: ${money(amount)}`,
    ) },
    { title: "Cash movements", lines: summary.movements.flatMap((movement) => [
      `Movement: ${movement.id}`, `Type: ${movement.kind}`, `Amount: ${money(movement.amount)}`,
      `Reason: ${movement.reason}`, `Responsible (user ID): ${movement.actor_id}`,
      `Time: ${registerDate(movement.created_at)}`, "",
    ]) },
    { title: "Receipts", lines: summary.receipts.flatMap((receipt) => [
      `Receipt: ${receipt.id}`, `Sale: ${receipt.sale_id}`, `Method: ${receipt.method}`,
      `Amount: ${money(receipt.amount)}`, `Tendered: ${money(receipt.tendered)}`, `Change: ${money(receipt.change)}`,
      `Responsible (user ID): ${receipt.actor_id}`, `Time: ${registerDate(receipt.received_at)}`, "",
    ]) },
  ]
  return sections
}

export function writeRegisterReport(builder: TicketBuilder, payload: RegisterReportPayload): void {
  for (const section of reportSections(payload)) {
    builder.bold(true).text(section.title, "center").bold(false)
    builder.separator()
    for (const value of section.lines) {
      // Wrap every audit field rather than using truncating receipt columns.
      for (const line of value.split(/\r?\n/)) builder.text(line)
    }
    builder.feed(1)
  }
  builder.cut()
}

export function encodeRegisterReport(payload: RegisterReportPayload, paper: PaperWidthMm): Uint8Array {
  const builder = new EscPosBuilder(paper)
  writeRegisterReport(builder, payload)
  return builder.build()
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

/** System output keeps Unicode audit text and never loads interpolated assets. */
export function registerReportHtml(payload: RegisterReportPayload, paper: PaperWidthMm): string {
  const body = reportSections(payload).map((section) =>
    `<section><h2>${escapeHtml(section.title)}</h2>${section.lines.map(
      (line) => `<p>${escapeHtml(line)}</p>`,
    ).join("")}</section>`,
  ).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cash Register Report</title>
<style>@page{size:${paper}mm auto;margin:2mm}body{margin:0;color:#111;background:#fff}
.ticket{width:${paper - 4}mm;max-width:100%;margin:auto;font:11px/1.35 monospace}
h2{font-size:14px;text-align:center;border-bottom:1px dashed #111;padding-bottom:6px}
p{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}section{margin-bottom:16px}</style>
</head><body><main class="ticket">${body}</main></body></html>`
}