import { resolveTicketLocale } from "../core/copy"
import { lineCols, toEscPosAscii, wrapText } from "../core/escpos"
import type { TicketAlign, TicketBuilder } from "../core/ticket-builder"
import {
  charsPerLine,
  type InventoryLabelPayload,
  type KitchenPayload,
  type PaperWidthMm,
  type PrintJob,
  type ReceiptPayload,
  type TestPrintPayload,
} from "../core/types"
import { writeReceipt } from "./receipt"
import { writeKitchenTicket } from "./kitchen"
import { writeKitchenDelta } from "./kitchen-delta"
import { writeInventoryLabel } from "./inventory-label"
import { writeTestPrint } from "./test"

type ThermalLine =
  | {
      kind: "text"
      text: string
      align: TicketAlign
      bold: boolean
      double: boolean
      invert: boolean
    }
  | { kind: "qr"; value: string }
  | { kind: "feed" }
  | { kind: "bar"; height: number }

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export class HtmlThermalBuilder implements TicketBuilder {
  readonly width: number
  private lines: ThermalLine[] = []
  private boldOn = false
  private doubleOn = false
  private wideOn = false
  private invertOn = false

  constructor(paper: PaperWidthMm) {
    this.width = charsPerLine(paper)
  }

  private cols(): number {
    return lineCols(this.width, this.wideOn)
  }

  text(value: string, align: TicketAlign = "left"): this {
    const ascii = toEscPosAscii(value)
    for (const line of wrapText(ascii, this.cols())) {
      this.lines.push({
        kind: "text",
        text: line,
        align,
        bold: this.boldOn,
        double: this.doubleOn,
        invert: this.invertOn,
      })
    }
    return this
  }

  rawLine(value: string): this {
    this.lines.push({
      kind: "text",
      text: toEscPosAscii(value).slice(0, this.cols()),
      align: "left",
      bold: this.boldOn,
      double: this.doubleOn,
      invert: this.invertOn,
    })
    return this
  }

  bold(on: boolean): this {
    this.boldOn = on
    return this
  }

  size(doubleHeight: boolean, doubleWidth = false): this {
    this.doubleOn = doubleHeight || doubleWidth
    this.wideOn = doubleWidth
    return this
  }

  invert(on: boolean): this {
    this.invertOn = on
    return this
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) this.lines.push({ kind: "feed" })
    return this
  }

  separator(char = "-"): this {
    return this.rawLine(char.repeat(this.width))
  }

  blackBar(heightDots = 4): this {
    this.lines.push({ kind: "bar", height: heightDots })
    return this
  }

  qr(data: string, _moduleSize?: number): this {
    this.lines.push({ kind: "qr", value: toEscPosAscii(data) })
    return this
  }

  cut(): this {
    this.feed(1)
    return this
  }

  toHtml(paper: PaperWidthMm, title: string, locale?: string | null): string {
    const lang = resolveTicketLocale(locale)
    const base = paper === 58 ? 12 : 13
    const body = this.lines
      .map((line) => {
        if (line.kind === "feed") return `<div class="feed"></div>`
        if (line.kind === "bar") return `<div class="bar" style="height:${Math.max(2, line.height)}px"></div>`
        if (line.kind === "qr") {
          return `<div class="qr" data-qr="${escapeHtml(line.value)}"></div>`
        }
        const cls = [
          "row",
          line.align,
          line.bold ? "bold" : "",
          line.double ? "tall" : "",
          line.invert ? "invert-row" : "",
        ]
          .filter(Boolean)
          .join(" ")
        return `<div class="${cls}">${escapeHtml(line.text)}</div>`
      })
      .join("")
    return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #d8d8d8; }
    .ticket {
      width: ${this.width}ch; box-sizing: content-box; margin: 10px auto;
      padding: 8px 6px 18px; background: #fff; color: #111;
      font-family: "Courier New", Courier, monospace;
      font-size: ${base}px; line-height: 1.2;
    }
    .row { white-space: pre; }
    .row.center { text-align: center; }
    .row.right { text-align: right; }
    .bold { font-weight: 700; }
    .tall { font-size: ${Math.round(base * 1.55)}px; line-height: 1.15; font-weight: 700; }
    .invert-row { background: #111; color: #fff; }
    .bar { background: #111; margin: 4px 0; }
    .feed { height: ${base}px; }
    .qr { display: flex; justify-content: center; margin: 8px 0 4px; }
  </style>
</head>
<body>
  <div class="ticket">${body}</div>
</body>
</html>`
  }
}

function writeJob(builder: TicketBuilder, job: PrintJob) {
  switch (job.template) {
    case "receipt":
      writeReceipt(builder, job.payload as ReceiptPayload)
      break
    case "kitchen":
      writeKitchenTicket(builder, job.payload as KitchenPayload)
      break
    case "kitchen-delta":
      writeKitchenDelta(builder, job.payload as KitchenPayload)
      break
    case "inventory-label":
      writeInventoryLabel(builder, job.payload as InventoryLabelPayload)
      break
    case "test":
      writeTestPrint(builder, job.payload as TestPrintPayload)
      break
    default:
      writeTestPrint(builder, { printerName: "Printer" })
  }
}

export function thermalHtmlForJob(job: PrintJob, paper: PaperWidthMm): string {
  const builder = new HtmlThermalBuilder(paper)
  writeJob(builder, job)
  const locale =
    job.payload && typeof job.payload === "object" && "locale" in job.payload
      ? (job.payload as { locale?: string | null }).locale
      : null
  return builder.toHtml(paper, job.template, locale)
}
