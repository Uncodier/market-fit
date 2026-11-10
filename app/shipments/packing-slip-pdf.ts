import { PDFDocument, StandardFonts } from "pdf-lib"
import { drawPdfText, sanitizePdfText } from "@/app/quotations/quotation-pdf-helpers"
import type { PackingSlipPayload } from "@/lib/printer/core/types"

export async function packingSlipPdf(payload: PackingSlipPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  let page = doc.addPage([595, 842])
  let y = 795
  const write = (text: string, size = 11) => {
    // Wrap even long unbroken references and paginate each physical line.
    for (const paragraph of sanitizePdfText(text).split(/\r?\n/)) {
      let line = ""
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(line + character, size) > 495) {
          flush(line, size)
          line = ""
        }
        line += character
      }
      flush(line, size)
    }
  }
  const flush = (text: string, size: number) => {
    if (y < 45) { page = doc.addPage([595, 842]); y = 795 }
    drawPdfText(page, text, { x: 50, y, size, font })
    y -= size + 7
  }
  write("Packing slip", 20)
  write("Internal document — not a carrier shipping label")
  if (payload.siteName) write(payload.siteName)
  write(`Shipment: ${payload.shipmentId}`)
  for (const [label, value] of [["Order", payload.orderNumber], ["Tracking", payload.trackingNumber],
    ["Carrier", payload.carrier], ["Customer", payload.customerName], ["Ship to", payload.shippingAddress],
    ["Created", payload.createdAt]]) if (value) write(`${label}: ${value}`)
  y -= 12
  write("Assigned items", 14)
  payload.lines.forEach((line) => write(`${line.quantity} × ${line.name}`))
  if (!payload.lines.length) write("No assigned items")
  if (payload.notes) { y -= 12; write(`Notes: ${payload.notes}`) }
  return doc.save()
}

export function downloadShipmentBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}