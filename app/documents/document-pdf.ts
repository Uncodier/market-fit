import { PDFDocument, StandardFonts } from "pdf-lib"
import {
  documentT,
  formatDocumentDate,
  formatDocumentMoney,
  resolveDocumentLocale,
  translateDocumentStatus,
  type DocumentStatusKind,
} from "@/app/lib/i18n/document-t"
import type { DocumentShippingAddress } from "@/app/documents/document-meta"
import { drawDocumentOrderMeta } from "@/app/documents/document-pdf-meta"
import {
  drawPdfWrappedText,
  drawRightText,
  embedPdfLogo,
  formatPdfLocationLines,
  pdfInk,
  pdfMuted,
  pdfRule,
  pdfSoftFill,
  resolveBillToLines,
  type QuotationPdfLocation,
} from "@/app/quotations/quotation-pdf-helpers"

export type DocumentPdfItem = {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
  status?: string | null
}

export type DocumentPdfInput = {
  docKindLabel: string
  docRef: string
  title?: string | null
  status?: string | null
  currency?: string | null
  created_at?: string | null
  valid_until?: string | null
  subtotal?: number | null
  tax_total?: number | null
  discount_total?: number | null
  total?: number | null
  items?: DocumentPdfItem[] | null
  party?: { name?: string | null; email?: string | null } | null
  site?: { name?: string | null; logo_url?: string | null; url?: string | null } | null
  location?: QuotationPdfLocation | null
  locale?: string | null
  viewLink: string
  reviewLabelKey?: string
  statusKind?: DocumentStatusKind
  fulfillmentMethod?: string | null
  paymentMethod?: string | null
  shippingAddress?: DocumentShippingAddress | null
}

/** Clean invoice-style A4 PDF shared by sales / orders / bills / quotes. */
export async function buildDocumentPdf(input: DocumentPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const locale = resolveDocumentLocale(input.locale)
  const currency = input.currency || "USD"
  const margin = 48
  const right = page.getWidth() - margin
  const contentWidth = right - margin
  let y = page.getHeight() - margin

  const t = (key: string) => documentT(locale, key)
  const siteName = input.site?.name || input.docKindLabel
  const logo = await embedPdfLogo(doc, input.site?.logo_url)

  if (logo) {
    const max = 40
    const scale = Math.min(max / logo.width, max / logo.height)
    const w = logo.width * scale
    const h = logo.height * scale
    page.drawImage(logo, { x: margin, y: y - h, width: w, height: h })
  }

  const titleX = logo ? margin + 52 : margin
  page.drawText(input.docKindLabel.toUpperCase().slice(0, 28), {
    x: titleX,
    y: y - 14,
    size: 20,
    font: bold,
    color: pdfInk,
  })
  page.drawText(`#${input.docRef}`, {
    x: titleX,
    y: y - 34,
    size: 12,
    font,
    color: pdfMuted,
  })

  drawRightText(page, t("quotations.document.created"), {
    right,
    y: y - 10,
    size: 9,
    font,
    color: pdfMuted,
  })
  drawRightText(page, formatDocumentDate(input.created_at, locale), {
    right,
    y: y - 26,
    size: 11,
    font: bold,
    color: pdfInk,
  })

  y -= 60
  page.drawLine({
    start: { x: margin, y },
    end: { x: right, y },
    thickness: 0.8,
    color: pdfRule,
  })
  y -= 22

  const colW = (contentWidth - 24) / 2
  const billX = margin + colW + 24
  page.drawText(t("quotations.document.from").toUpperCase(), {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: pdfMuted,
  })
  page.drawText(t("quotations.document.billTo").toUpperCase(), {
    x: billX,
    y,
    size: 8,
    font: bold,
    color: pdfMuted,
  })
  y -= 16

  let fromY = y
  page.drawText(siteName.slice(0, 40), {
    x: margin,
    y: fromY,
    size: 12,
    font: bold,
    color: pdfInk,
  })
  fromY -= 14
  if (input.site?.url) {
    fromY = drawPdfWrappedText(page, String(input.site.url).replace(/^https?:\/\//, ""), {
      x: margin,
      y: fromY,
      size: 9,
      font,
      color: pdfMuted,
      maxWidth: colW,
    })
  }
  for (const line of formatPdfLocationLines(input.location).slice(0, 3)) {
    fromY = drawPdfWrappedText(page, line, {
      x: margin,
      y: fromY,
      size: 9,
      font,
      color: pdfMuted,
      maxWidth: colW,
    })
  }

  const billTo = resolveBillToLines(input.party)
  let billY = y
  page.drawText(billTo.primary.slice(0, 40), {
    x: billX,
    y: billY,
    size: 12,
    font: bold,
    color: pdfInk,
  })
  billY -= 14
  if (billTo.secondary) {
    billY = drawPdfWrappedText(page, billTo.secondary, {
      x: billX,
      y: billY,
      size: 9,
      font,
      color: pdfMuted,
      maxWidth: colW,
    })
  }

  y = Math.min(fromY, billY) - 18

  page.drawRectangle({
    x: margin,
    y: y - 44,
    width: contentWidth,
    height: 56,
    color: pdfSoftFill,
  })
  page.drawText(t("quotations.document.total"), {
    x: margin + 16,
    y: y - 8,
    size: 8,
    font,
    color: pdfMuted,
  })
  page.drawText(formatDocumentMoney(input.total || 0, currency, locale), {
    x: margin + 16,
    y: y - 28,
    size: 14,
    font: bold,
    color: pdfInk,
  })
  if (input.status) {
    const statusLabel = translateDocumentStatus(
      locale,
      input.status,
      input.statusKind || "orders"
    )
    page.drawText(statusLabel.toUpperCase().slice(0, 28), {
      x: margin + contentWidth / 2,
      y: y - 28,
      size: 11,
      font: bold,
      color: pdfInk,
    })
  }
  y -= 72

  y = drawDocumentOrderMeta(page, {
    y,
    margin,
    contentWidth,
    locale,
    font,
    bold,
    fulfillmentMethod: input.fulfillmentMethod,
    paymentMethod: input.paymentMethod,
    shippingAddress: input.shippingAddress,
  })

  page.drawRectangle({
    x: margin,
    y: y - 6,
    width: contentWidth,
    height: 22,
    color: pdfSoftFill,
  })
  const lineItems = input.items || []
  const showItemStatus =
    input.statusKind === "orders" || lineItems.some((item) => Boolean(item.status))
  const cols = showItemStatus
    ? {
        name: margin + 10,
        status: margin + 210,
        qty: margin + 310,
        price: margin + 365,
        total: right - 10,
      }
    : {
        name: margin + 10,
        status: 0,
        qty: margin + 300,
        price: margin + 360,
        total: right - 10,
      }
  page.drawText(t("quotations.document.item"), {
    x: cols.name,
    y,
    size: 9,
    font: bold,
    color: pdfMuted,
  })
  if (showItemStatus) {
    page.drawText(t("quotations.document.status"), {
      x: cols.status,
      y,
      size: 9,
      font: bold,
      color: pdfMuted,
    })
  }
  page.drawText(t("quotations.document.qty"), {
    x: cols.qty,
    y,
    size: 9,
    font: bold,
    color: pdfMuted,
  })
  drawRightText(page, t("quotations.document.price"), {
    right: cols.price + 40,
    y,
    size: 9,
    font: bold,
    color: pdfMuted,
  })
  drawRightText(page, t("quotations.document.total"), {
    right: cols.total,
    y,
    size: 9,
    font: bold,
    color: pdfMuted,
  })
  y -= 24

  for (const item of lineItems) {
    if (y < 140) break
    page.drawText(
      (item.name || t("quotations.document.item")).slice(0, showItemStatus ? 28 : 42),
      {
        x: cols.name,
        y,
        size: 10,
        font,
        color: pdfInk,
      }
    )
    if (showItemStatus) {
      const lineStatus = item.status
        ? translateDocumentStatus(
            locale,
            item.status,
            input.statusKind || "orders"
          )
        : "—"
      page.drawText(lineStatus.toUpperCase().slice(0, 14), {
        x: cols.status,
        y,
        size: 9,
        font,
        color: pdfInk,
      })
    }
    page.drawText(String(item.quantity ?? 0), {
      x: cols.qty + 6,
      y,
      size: 10,
      font,
      color: pdfInk,
    })
    drawRightText(page, formatDocumentMoney(item.unit_price, currency, locale), {
      right: cols.price + 40,
      y,
      size: 10,
      font,
      color: pdfInk,
    })
    drawRightText(page, formatDocumentMoney(item.subtotal, currency, locale), {
      right: cols.total,
      y,
      size: 10,
      font: bold,
      color: pdfInk,
    })
    y -= 10
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: right, y: y + 4 },
      thickness: 0.4,
      color: pdfRule,
    })
    y -= 14
  }

  y -= 8
  const totalsX = right - 180
  const drawTotal = (label: string, value: string, emphasize = false) => {
    page.drawText(label, {
      x: totalsX,
      y,
      size: emphasize ? 11 : 9,
      font: emphasize ? bold : font,
      color: emphasize ? pdfInk : pdfMuted,
    })
    drawRightText(page, value, {
      right,
      y,
      size: emphasize ? 12 : 10,
      font: emphasize ? bold : font,
      color: pdfInk,
    })
    y -= emphasize ? 20 : 16
  }

  drawTotal(
    t("quotations.document.subtotal"),
    formatDocumentMoney(input.subtotal || 0, currency, locale)
  )
  if (Number(input.tax_total) > 0) {
    drawTotal(
      t("quotations.document.tax"),
      formatDocumentMoney(input.tax_total || 0, currency, locale)
    )
  }
  if (Number(input.discount_total) > 0) {
    drawTotal(
      t("quotations.document.discount"),
      `-${formatDocumentMoney(input.discount_total || 0, currency, locale)}`
    )
  }
  page.drawLine({
    start: { x: totalsX, y: y + 10 },
    end: { x: right, y: y + 10 },
    thickness: 0.7,
    color: pdfRule,
  })
  drawTotal(
    t("quotations.document.total"),
    formatDocumentMoney(input.total || 0, currency, locale),
    true
  )

  y -= 10
  page.drawRectangle({
    x: margin,
    y: y - 36,
    width: contentWidth,
    height: 44,
    color: pdfSoftFill,
  })
  const reviewKey = input.reviewLabelKey || "quotations.document.reviewOnline"
  page.drawText(t(reviewKey), {
    x: margin + 12,
    y: y - 12,
    size: 9,
    font: bold,
    color: pdfInk,
  })
  page.drawText(input.viewLink.slice(0, 78), {
    x: margin + 12,
    y: y - 28,
    size: 8,
    font,
    color: pdfMuted,
  })

  return doc.save()
}

export function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
