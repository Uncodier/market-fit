import { PDFDocument, StandardFonts } from "pdf-lib"
import {
  documentT,
  formatDocumentDate,
  formatDocumentMoney,
  resolveDocumentLocale,
} from "@/app/lib/i18n/document-t"
import {
  drawPdfText,
  drawPdfWrappedText,
  drawRightText,
  embedPdfLogo,
  formatPdfLocationLines,
  pdfInk,
  pdfMuted,
  pdfRule,
  pdfSoftFill,
  resolveBillToLines,
  sanitizePdfText,
  type QuotationPdfLocation,
} from "@/app/quotations/quotation-pdf-helpers"

export type QuotationPdfItem = {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export type QuotationPdfSite = {
  name?: string | null
  logo_url?: string | null
  url?: string | null
}

export type QuotationPdfInput = {
  id: string
  title?: string | null
  status?: string | null
  currency?: string | null
  created_at?: string | null
  valid_until?: string | null
  subtotal?: number | null
  tax_total?: number | null
  discount_total?: number | null
  total?: number | null
  notes?: string | null
  items?: QuotationPdfItem[] | null
  lead?: { name?: string | null; email?: string | null } | null
  site?: QuotationPdfSite | null
  location?: QuotationPdfLocation | null
  locale?: string | null
  buyerLink: string
}

/**
 * Clean invoice-style A4 PDF (matches /quote-pdf HTML print layout / sales invoice-pdf).
 */
export async function buildQuotationPdf(input: QuotationPdfInput): Promise<Uint8Array> {
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
  const siteName = sanitizePdfText(input.site?.name) || t("quotations.document.quote")
  const quoteRef = input.id.substring(0, 8)
  const logo = await embedPdfLogo(doc, input.site?.logo_url)

  // Header
  if (logo) {
    const max = 40
    const scale = Math.min(max / logo.width, max / logo.height)
    const w = logo.width * scale
    const h = logo.height * scale
    page.drawImage(logo, { x: margin, y: y - h, width: w, height: h })
  }

  const titleX = logo ? margin + 52 : margin
  drawPdfText(page, t("quotations.document.quote").toUpperCase(), {
    x: titleX,
    y: y - 14,
    size: 22,
    font: bold,
    color: pdfInk,
  })
  drawPdfText(page, `#${quoteRef}`, {
    x: titleX,
    y: y - 34,
    size: 12,
    font,
    color: pdfMuted,
  })
  if (input.title) {
    drawPdfText(page, sanitizePdfText(String(input.title)).slice(0, 40), {
      x: titleX,
      y: y - 50,
      size: 9,
      font,
      color: pdfMuted,
    })
  }

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
  drawRightText(page, t("quotations.document.validUntil"), {
    right,
    y: y - 46,
    size: 9,
    font,
    color: pdfMuted,
  })
  drawRightText(page, formatDocumentDate(input.valid_until, locale), {
    right,
    y: y - 62,
    size: 10,
    font: bold,
    color: pdfInk,
  })

  y -= 78
  page.drawLine({
    start: { x: margin, y },
    end: { x: right, y },
    thickness: 0.8,
    color: pdfRule,
  })
  y -= 24

  // From / Bill to
  const colW = (contentWidth - 24) / 2
  const billX = margin + colW + 24
  drawPdfText(page, t("quotations.document.from").toUpperCase(), {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: pdfMuted,
  })
  drawPdfText(page, t("quotations.document.billTo").toUpperCase(), {
    x: billX,
    y,
    size: 8,
    font: bold,
    color: pdfMuted,
  })
  y -= 16

  let fromY = y
  drawPdfText(page, siteName.slice(0, 40), {
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

  const billTo = resolveBillToLines(input.lead)
  let billY = y
  drawPdfText(page, sanitizePdfText(billTo.primary).slice(0, 40), {
    x: billX,
    y: billY,
    size: 12,
    font: bold,
    color: pdfInk,
  })
  billY -= 14
  if (billTo.secondary) {
    billY = drawPdfWrappedText(page, sanitizePdfText(billTo.secondary), {
      x: billX,
      y: billY,
      size: 9,
      font,
      color: pdfMuted,
      maxWidth: colW,
    })
  }

  y = Math.min(fromY, billY) - 18

  // Summary strip
  page.drawRectangle({
    x: margin,
    y: y - 44,
    width: contentWidth,
    height: 56,
    color: pdfSoftFill,
  })
  const col1 = margin + 16
  const col2 = margin + contentWidth / 3 + 8
  const col3 = margin + (contentWidth * 2) / 3 + 8
  drawPdfText(page, t("quotations.document.total"), {
    x: col1,
    y: y - 8,
    size: 8,
    font,
    color: pdfMuted,
  })
  drawPdfText(page, formatDocumentMoney(input.total || 0, currency, locale), {
    x: col1,
    y: y - 28,
    size: 14,
    font: bold,
    color: pdfInk,
  })
  drawPdfText(page, "STATUS", {
    x: col2,
    y: y - 8,
    size: 8,
    font,
    color: pdfMuted,
  })
  drawPdfText(page, String(input.status || "draft").toUpperCase(), {
    x: col2,
    y: y - 28,
    size: 11,
    font: bold,
    color: pdfInk,
  })
  drawPdfText(page, t("quotations.document.validUntil"), {
    x: col3,
    y: y - 8,
    size: 8,
    font,
    color: pdfMuted,
  })
  drawPdfText(page, formatDocumentDate(input.valid_until, locale), {
    x: col3,
    y: y - 28,
    size: 11,
    font: bold,
    color: pdfInk,
  })
  y -= 72

  // Table header
  page.drawRectangle({
    x: margin,
    y: y - 6,
    width: contentWidth,
    height: 22,
    color: pdfSoftFill,
  })
  const cols = {
    name: margin + 10,
    qty: margin + 300,
    price: margin + 360,
    total: right - 10,
  }
  drawPdfText(page, t("quotations.document.item"), {
    x: cols.name,
    y,
    size: 9,
    font: bold,
    color: pdfMuted,
  })
  drawPdfText(page, t("quotations.document.qty"), {
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

  for (const item of input.items || []) {
    if (y < 140) break
    drawPdfText(page, sanitizePdfText(item.name || t("quotations.document.item")).slice(0, 42), {
      x: cols.name,
      y,
      size: 10,
      font,
      color: pdfInk,
    })
    drawPdfText(page, String(item.quantity ?? 0), {
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
    drawPdfText(page, label, {
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
  drawPdfText(page, t("quotations.document.reviewOnline"), {
    x: margin + 12,
    y: y - 12,
    size: 9,
    font: bold,
    color: pdfInk,
  })
  drawPdfText(page, input.buyerLink.slice(0, 78), {
    x: margin + 12,
    y: y - 28,
    size: 8,
    font,
    color: pdfMuted,
  })

  // Notes Page (if notes exist)
  const isLongNote = input.notes && (input.notes.length > 800 || input.notes.split('\n').length > 15)
  
  if (input.notes && input.notes.trim()) {
    let notesPage = page
    let ny = y - 24

    if (isLongNote) {
      notesPage = doc.addPage([595.28, 841.89])
      ny = notesPage.getHeight() - margin

      drawPdfText(notesPage, t("quotations.document.quote").toUpperCase(), {
        x: margin,
        y: ny - 14,
        size: 22,
        font: bold,
        color: pdfInk,
      })
      drawPdfText(notesPage, `#${quoteRef}`, {
        x: margin,
        y: ny - 34,
        size: 12,
        font,
        color: pdfMuted,
      })
      
      ny -= 64
    }

    drawPdfText(notesPage, t("quotations.detail.notes") || "Notes", {
      x: margin,
      y: ny,
      size: 10,
      font: bold,
      color: pdfInk,
    })
    
    ny -= 16
    
    // Very simple Markdown parser for PDF
    const safeNotes = sanitizePdfText(input.notes)
    const lines = safeNotes.split('\n')
    for (const line of lines) {
      if (ny < margin + 20) {
        // Need new page (not fully handling multi-page notes, but avoiding crashing off bottom)
        notesPage = doc.addPage([595.28, 841.89])
        ny = notesPage.getHeight() - margin
      }
      
      const trimmed = line.trim()
      if (!trimmed) {
        ny -= 14
        continue
      }
      
      let isBold = false
      let textToDraw = trimmed
      let size = 9
      let indent = 0
      
      // Headers
      if (trimmed.startsWith('### ')) {
        isBold = true
        size = 10
        textToDraw = trimmed.substring(4)
      } else if (trimmed.startsWith('## ')) {
        isBold = true
        size = 11
        textToDraw = trimmed.substring(3)
      } else if (trimmed.startsWith('# ')) {
        isBold = true
        size = 12
        textToDraw = trimmed.substring(2)
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        textToDraw = '• ' + trimmed.substring(2)
        indent = 10
      } else if (/^\d+\.\s/.test(trimmed)) {
        indent = 10
      }
      
      // Inline bold stripping (**text**) - simplified just removing the asterisks
      textToDraw = textToDraw.replace(/\*\*(.*?)\*\*/g, '$1')
      textToDraw = textToDraw.replace(/__(.*?)__/g, '$1')
      
      // If it's a short note on the first page, wrap it tighter to avoid the totals block on the right
      const maxWidth = !isLongNote && notesPage === page ? contentWidth - 200 : contentWidth - indent

      ny = drawPdfWrappedText(notesPage, textToDraw, {
        x: margin + indent,
        y: ny,
        size,
        font: isBold ? bold : font,
        color: pdfInk,
        maxWidth,
        lineHeight: size + 4,
      })
    }
  }

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
