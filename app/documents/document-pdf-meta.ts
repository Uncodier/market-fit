import type { PDFFont, PDFPage } from "pdf-lib"
import { documentT } from "@/app/lib/i18n/document-t"
import {
  formatShippingAddressLines,
  translateFulfillmentMethod,
  translatePaymentMethod,
  type DocumentShippingAddress,
} from "@/app/documents/document-meta"
import {
  drawPdfWrappedText,
  pdfInk,
  pdfMuted,
} from "@/app/quotations/quotation-pdf-helpers"

/** Draws fulfillment / payment / shipping block. Returns the next y position. */
export function drawDocumentOrderMeta(
  page: PDFPage,
  opts: {
    y: number
    margin: number
    contentWidth: number
    locale: string | null | undefined
    font: PDFFont
    bold: PDFFont
    fulfillmentMethod?: string | null
    paymentMethod?: string | null
    shippingAddress?: DocumentShippingAddress | null
  }
): number {
  let y = opts.y
  const fulfillmentLabel = translateFulfillmentMethod(
    opts.locale,
    opts.fulfillmentMethod
  )
  const paymentLabel = translatePaymentMethod(opts.locale, opts.paymentMethod)
  const shippingLines = formatShippingAddressLines(opts.shippingAddress)
  if (!fulfillmentLabel && !paymentLabel && shippingLines.length === 0) {
    return y
  }

  const t = (key: string) => documentT(opts.locale, key)
  const metaX = opts.margin + opts.contentWidth / 2

  if (fulfillmentLabel) {
    page.drawText(t("quotations.document.fulfillment").toUpperCase(), {
      x: opts.margin,
      y,
      size: 8,
      font: opts.bold,
      color: pdfMuted,
    })
    page.drawText(fulfillmentLabel.slice(0, 36), {
      x: opts.margin,
      y: y - 14,
      size: 11,
      font: opts.bold,
      color: pdfInk,
    })
  }
  if (paymentLabel) {
    page.drawText(t("quotations.document.paymentMethod").toUpperCase(), {
      x: metaX,
      y,
      size: 8,
      font: opts.bold,
      color: pdfMuted,
    })
    page.drawText(paymentLabel.slice(0, 36), {
      x: metaX,
      y: y - 14,
      size: 11,
      font: opts.bold,
      color: pdfInk,
    })
  }
  y -= 34

  if (shippingLines.length > 0) {
    page.drawText(t("quotations.document.shippingAddress").toUpperCase(), {
      x: opts.margin,
      y,
      size: 8,
      font: opts.bold,
      color: pdfMuted,
    })
    y -= 14
    for (const line of shippingLines.slice(0, 3)) {
      y = drawPdfWrappedText(page, line, {
        x: opts.margin,
        y,
        size: 9,
        font: opts.font,
        color: pdfInk,
        maxWidth: opts.contentWidth,
      })
    }
    y -= 8
  }

  return y - 10
}
