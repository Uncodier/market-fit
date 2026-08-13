import { resolveTicketLocale, ticketCopy } from "../core/copy"
import {
  formatMoney,
  formatTicketDateParts,
  fulfillmentLabel,
  paymentMethodLabel,
} from "../core/format"
import type { PaperWidthMm } from "../core/types"
import type {
  InventoryLabelPayload,
  KitchenPayload,
  PrintJob,
  ReceiptPayload,
  TestPrintPayload,
  TicketBrand,
} from "../core/types"

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function ticketCss(paper: PaperWidthMm): string {
  const widthPx = paper === 58 ? 260 : 360
  return `
    @page { size: ${paper}mm auto; margin: 2mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    .ticket {
      width: ${widthPx}px; max-width: 100%; margin: 0 auto; padding: 4px 2px 10px;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 11px; line-height: 1.35; color: #111;
    }
    .logo { display: block; max-width: 70%; max-height: 52px; margin: 0 auto 6px; object-fit: contain; }
    .brand { font-size: ${paper === 58 ? 15 : 17}px; font-weight: 800; text-align: center; letter-spacing: -0.03em; }
    .meta { text-align: center; font-size: 10px; color: #333; }
    .order { font-size: ${paper === 58 ? 18 : 22}px; font-weight: 800; text-align: center; margin: 8px 0 2px; letter-spacing: -0.04em; }
    .when { text-align: center; font-size: 10px; color: #222; margin-bottom: 6px; }
    .badge { display: block; text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border: 1.5px solid #111; padding: 3px 0; margin: 6px 0; }
    .banner { background: #111; color: #fff; text-align: center; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 4px; margin: 0 0 8px; font-size: ${paper === 58 ? 16 : 18}px; }
    .banner.sub { background: #111; margin: 10px 0 6px; font-size: ${paper === 58 ? 14 : 16}px; padding: 8px 4px; }
    .hr { border: 0; border-top: 1px dashed #111; margin: 8px 0; }
    .hr-solid { border: 0; border-top: 2px solid #111; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin: 2px 0; }
    .muted { color: #444; }
    .item { margin: 6px 0; }
    .item .name { font-weight: 700; font-size: 12px; }
    .item .mod { padding-left: 10px; font-size: 10px; color: #333; }
    .qty { font-weight: 800; font-variant-numeric: tabular-nums; min-width: 1.6em; }
    .kitchen-item { display: flex; gap: 8px; align-items: flex-start; margin: 8px 0; }
    .kitchen-qty { font-size: ${paper === 58 ? 20 : 24}px; font-weight: 900; line-height: 1; min-width: 1.4em; }
    .kitchen-name { font-size: ${paper === 58 ? 13 : 15}px; font-weight: 800; }
    .total { font-size: 15px; font-weight: 800; }
    .notes { border: 1.5px solid #111; padding: 6px 8px; margin-top: 8px; font-size: 11px; }
    .notes strong { display: block; font-size: 9px; letter-spacing: 0.1em; margin-bottom: 2px; }
    .footer { text-align: center; font-size: 10px; margin-top: 10px; }
    .thanks { font-weight: 800; font-size: 12px; margin-bottom: 2px; }
    .qr { display: flex; justify-content: center; margin: 8px 0 4px; }
    .qr-caption { text-align: center; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #333; }
    .code { text-align: center; font-family: ui-monospace, Menlo, monospace; font-size: 10px; word-break: break-all; }
    .void { text-decoration: line-through; opacity: 0.85; }
    .delta-line { font-weight: 800; font-size: 13px; margin: 4px 0; }
    @media print { .ticket { width: ${paper}mm; } }
  `
}

export function thermalHtmlDocument(
  inner: string,
  paper: PaperWidthMm,
  title = "Print",
  locale?: string | null,
): string {
  const lang = resolveTicketLocale(locale)
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${ticketCss(paper)}</style>
</head>
<body>
  <div class="ticket">${inner}</div>
</body>
</html>`
}

function brandBlock(brand: TicketBrand): string {
  const copy = ticketCopy(brand.locale)
  const bits = [brand.address, brand.phone, brand.website].filter(Boolean).map(String)
  return `
    ${brand.logoUrl ? `<img class="logo" src="${escapeHtml(brand.logoUrl)}" alt="" />` : ""}
    <div class="brand">${escapeHtml(brand.siteName || "")}</div>
    ${bits.length ? `<div class="meta">${bits.map(escapeHtml).join("<br/>")}</div>` : ""}
    ${brand.taxId ? `<div class="meta">${escapeHtml(copy.taxId)} ${escapeHtml(brand.taxId)}</div>` : ""}
  `
}

function whenLine(iso?: string | null, locale?: string | null): string {
  const { date, time } = formatTicketDateParts(iso, locale)
  return `<div class="when">${escapeHtml(date)} · ${escapeHtml(time)}</div>`
}

export function receiptHtml(payload: ReceiptPayload, paper: PaperWidthMm): string {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const currency = payload.currency || "USD"
  const fulfill = fulfillmentLabel(payload.fulfillment, locale)
  const items = (payload.lines || [])
    .map((line) => {
      const mods = (line.modifiers || [])
        .map((m) => `<div class="mod">+ ${m.quantity}× ${escapeHtml(m.name)}</div>`)
        .join("")
      return `<div class="item">
        <div class="row">
          <div><span class="qty">${line.quantity}×</span> <span class="name">${escapeHtml(line.name)}</span></div>
          <div>${escapeHtml(formatMoney(line.subtotal, currency, locale))}</div>
        </div>
        ${mods}
      </div>`
    })
    .join("")
  const totals: string[] = []
  if (payload.subtotal != null) {
    totals.push(`<div class="kv"><span class="muted">${escapeHtml(copy.subtotal)}</span><span>${escapeHtml(formatMoney(payload.subtotal, currency, locale))}</span></div>`)
  }
  if (payload.discountTotal) {
    totals.push(`<div class="kv"><span class="muted">${escapeHtml(copy.discount)}</span><span>−${escapeHtml(formatMoney(payload.discountTotal, currency, locale))}</span></div>`)
  }
  if (payload.taxTotal) {
    totals.push(`<div class="kv"><span class="muted">${escapeHtml(copy.tax)}</span><span>${escapeHtml(formatMoney(payload.taxTotal, currency, locale))}</span></div>`)
  }
  const pays = (payload.payments || [])
    .map((p) => {
      const change =
        p.change && p.change > 0
          ? `<div class="kv"><span class="muted">${escapeHtml(copy.change)}</span><span>${escapeHtml(formatMoney(p.change, currency, locale))}</span></div>`
          : ""
      return `<div class="kv"><span>${escapeHtml(paymentMethodLabel(p.method, locale))}</span><span>${escapeHtml(formatMoney(p.amount, currency, locale))}</span></div>${change}`
    })
    .join("")
  const qr = payload.qrValue || payload.orderNumber
  const inner = `
    ${brandBlock(payload)}
    <hr class="hr-solid" />
    ${payload.orderNumber ? `<div class="order">#${escapeHtml(payload.orderNumber)}</div>` : `<div class="order">${escapeHtml(copy.receipt)}</div>`}
    ${whenLine(payload.createdAt, locale)}
    ${fulfill ? `<div class="badge">${escapeHtml(fulfill)}</div>` : ""}
    ${payload.customerName ? `<div class="kv"><span class="muted">${escapeHtml(copy.customer)}</span><span>${escapeHtml(payload.customerName)}</span></div>` : ""}
    ${payload.locationName ? `<div class="kv"><span class="muted">${escapeHtml(copy.location)}</span><span>${escapeHtml(payload.locationName)}</span></div>` : ""}
    ${payload.cashierName ? `<div class="kv"><span class="muted">${escapeHtml(copy.cashier)}</span><span>${escapeHtml(payload.cashierName)}</span></div>` : ""}
    <hr class="hr" />
    ${items}
    <hr class="hr-solid" />
    ${totals.join("")}
    <div class="row total"><span>${escapeHtml(copy.total)}</span><span>${escapeHtml(formatMoney(payload.total ?? 0, currency, locale))}</span></div>
    ${pays}
    ${payload.notes ? `<div class="notes"><strong>${escapeHtml(copy.notes)}</strong>${escapeHtml(payload.notes)}</div>` : ""}
    ${qr ? `<div class="qr" data-qr="${escapeHtml(qr)}"></div><div class="qr-caption">${escapeHtml(copy.order)}</div>` : ""}
    <div class="footer">
      <div class="thanks">${escapeHtml(copy.thankYou)}</div>
      ${payload.website ? `<div>${escapeHtml(payload.website)}</div>` : ""}
    </div>
  `
  return thermalHtmlDocument(inner, paper, copy.receipt, locale)
}

export function kitchenHtml(payload: KitchenPayload, paper: PaperWidthMm): string {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const fulfill = fulfillmentLabel(payload.fulfillment, locale)
  const items = (payload.lines || [])
    .map((line) => {
      const mods = (line.modifiers || [])
        .map((m) => `<div class="mod">+ ${m.quantity}× ${escapeHtml(m.name)}</div>`)
        .join("")
      return `<div class="kitchen-item">
        <div class="kitchen-qty">${line.quantity}</div>
        <div>
          <div class="kitchen-name">${escapeHtml(line.name)}</div>
          ${mods}
          ${line.notes ? `<div class="mod">${escapeHtml(line.notes)}</div>` : ""}
        </div>
      </div>`
    })
    .join("")
  const inner = `
    <div class="banner">${escapeHtml(copy.kitchen)}</div>
    ${payload.orderNumber ? `<div class="order">#${escapeHtml(payload.orderNumber)}</div>` : ""}
    ${whenLine(payload.createdAt, locale)}
    ${fulfill ? `<div class="badge">${escapeHtml(fulfill)}</div>` : ""}
    ${payload.tableName ? `<div class="kv"><span class="muted">${escapeHtml(copy.table)}</span><span>${escapeHtml(payload.tableName)}</span></div>` : ""}
    ${payload.customerName ? `<div class="kv"><span class="muted">${escapeHtml(copy.customer)}</span><span>${escapeHtml(payload.customerName)}</span></div>` : ""}
    <hr class="hr-solid" />
    ${items}
    ${payload.notes ? `<div class="notes"><strong>${escapeHtml(copy.notes)}</strong>${escapeHtml(payload.notes)}</div>` : ""}
  `
  return thermalHtmlDocument(inner, paper, copy.kitchen, locale)
}

export function kitchenDeltaHtml(payload: KitchenPayload, paper: PaperWidthMm): string {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const delta = payload.delta
  const addBlock = delta?.adds.length
    ? `<div class="banner sub">${escapeHtml(copy.add)}</div>${delta.adds
        .map(
          (line) =>
            `<div class="delta-line">${line.quantity}× ${escapeHtml(line.name)}</div>${(line.modifiers || [])
              .map((m) => `<div class="mod">+ ${m.quantity}× ${escapeHtml(m.name)}</div>`)
              .join("")}`,
        )
        .join("")}`
    : ""
  const qtyBlock = delta?.qtyChanges.length
    ? `<div class="banner sub">${escapeHtml(copy.qty)}</div>${delta.qtyChanges
        .map(
          (c) =>
            `<div class="row delta-line"><span>${escapeHtml(c.name)}</span><span>${c.from} → ${c.to}</span></div>`,
        )
        .join("")}`
    : ""
  const voidBlock = delta?.voids.length
    ? `<div class="banner sub">${escapeHtml(copy.voidLabel)}</div>${delta.voids
        .map((line) => `<div class="delta-line void">${line.quantity}× ${escapeHtml(line.name)}</div>`)
        .join("")}`
    : ""
  const inner = `
    <div class="banner">${escapeHtml(copy.update)}</div>
    ${payload.orderNumber ? `<div class="order">#${escapeHtml(payload.orderNumber)}</div>` : ""}
    ${whenLine(payload.createdAt, locale)}
    ${fulfillmentLabel(payload.fulfillment, locale) ? `<div class="badge">${escapeHtml(fulfillmentLabel(payload.fulfillment, locale))}</div>` : ""}
    <hr class="hr-solid" />
    ${addBlock}${qtyBlock}${voidBlock}
    ${payload.notes ? `<div class="notes"><strong>${escapeHtml(copy.notes)}</strong>${escapeHtml(payload.notes)}</div>` : ""}
  `
  return thermalHtmlDocument(inner, paper, copy.update, locale)
}

export function inventoryLabelHtml(
  payload: InventoryLabelPayload,
  paper: PaperWidthMm,
): string {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const printed = formatTicketDateParts(payload.printedAt, locale)
  const inner = `
    ${payload.siteName ? `<div class="meta">${escapeHtml(payload.siteName)}</div>` : ""}
    <div class="banner">${escapeHtml(copy.inventory)}</div>
    <div class="order" style="font-size:16px">${escapeHtml(payload.name)}</div>
    ${payload.sku ? `<div class="code">${escapeHtml(payload.sku)}</div>` : ""}
    <hr class="hr" />
    ${payload.locationName ? `<div class="kv"><span class="muted">${escapeHtml(copy.location)}</span><span>${escapeHtml(payload.locationName)}</span></div>` : ""}
    ${payload.quantity != null ? `<div class="kv"><span class="muted">${escapeHtml(copy.onHand)}</span><span>${payload.quantity}</span></div>` : ""}
    <div class="kv"><span class="muted">${escapeHtml(copy.printed)}</span><span>${escapeHtml(printed.date)}</span></div>
    <div class="qr" data-qr="${escapeHtml(payload.qrValue)}"></div>
    <div class="qr-caption">${escapeHtml(copy.traceability)}</div>
    <div class="code">${escapeHtml(payload.qrValue)}</div>
  `
  return thermalHtmlDocument(inner, paper, copy.inventory, locale)
}

export function testPrintHtml(payload: TestPrintPayload, paper: PaperWidthMm): string {
  const copy = ticketCopy(payload.locale)
  const locale = payload.locale
  const when = formatTicketDateParts(undefined, locale)
  const inner = `
    <div class="banner">${escapeHtml(payload.title || copy.stationSynced)}</div>
    <div class="brand">${escapeHtml(payload.printerName || copy.testPrint)}</div>
    <div class="meta" style="margin: 6px 0 10px">${escapeHtml(copy.syncLinked)}</div>
    ${payload.stationName ? `<div class="kv"><span class="muted">${escapeHtml(copy.computer)}</span><span>${escapeHtml(payload.stationName)}</span></div>` : ""}
    ${payload.hardwareName ? `<div class="kv"><span class="muted">${escapeHtml(copy.device)}</span><span>${escapeHtml(payload.hardwareName)}</span></div>` : ""}
    <div class="kv"><span class="muted">${escapeHtml(copy.paper)}</span><span>${paper} mm</span></div>
    <hr class="hr" />
    <div class="when">${escapeHtml(when.date)} ${escapeHtml(when.time)}</div>
    <div class="footer"><div class="thanks">${escapeHtml(copy.readyToPrint)}</div></div>
  `
  return thermalHtmlDocument(inner, paper, copy.stationSynced, locale)
}

export function htmlForJob(job: PrintJob, paper: PaperWidthMm): string {
  switch (job.template) {
    case "receipt":
      return receiptHtml(job.payload as ReceiptPayload, paper)
    case "kitchen":
      return kitchenHtml(job.payload as KitchenPayload, paper)
    case "kitchen-delta":
      return kitchenDeltaHtml(job.payload as KitchenPayload, paper)
    case "inventory-label":
      return inventoryLabelHtml(job.payload as InventoryLabelPayload, paper)
    case "test":
      return testPrintHtml(job.payload as TestPrintPayload, paper)
    default:
      return thermalHtmlDocument("<div class='brand'>Print</div>", paper)
  }
}
