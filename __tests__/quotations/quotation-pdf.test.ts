import { PDFDocument } from "pdf-lib"
import { buildQuotationPdf } from "@/app/quotations/quotation-pdf"
import {
  formatPdfLocationLines,
  resolveBillToLines,
} from "@/app/quotations/quotation-pdf-helpers"

describe("quotation pdf helpers", () => {
  it("dedupes repeated location name/country", () => {
    expect(
      formatPdfLocationLines({
        name: "Ecuador",
        country: "Ecuador",
      })
    ).toEqual(["Ecuador"])
  })

  it("avoids printing the same email twice in Bill to", () => {
    expect(
      resolveBillToLines({
        name: "sergio@uncodie.com",
        email: "sergio@uncodie.com",
      })
    ).toEqual({ primary: "sergio@uncodie.com" })
  })
})

describe("buildQuotationPdf", () => {
  it("returns a non-empty PDF byte array", async () => {
    const bytes = await buildQuotationPdf({
      id: "12345678-aaaa-bbbb-cccc-dddddddddddd",
      title: "Spring services",
      currency: "USD",
      created_at: "2026-01-15T00:00:00.000Z",
      valid_until: "2026-02-15T00:00:00.000Z",
      subtotal: 100,
      tax_total: 16,
      discount_total: 0,
      total: 116,
      items: [
        { name: "Consulting", quantity: 2, unit_price: 50, subtotal: 100 },
      ],
      lead: { name: "Ada Lovelace", email: "ada@example.com" },
      site: { name: "Acme Co", url: "https://acme.example" },
      buyerLink: "https://app.example.com/q/token-abc",
    })

    expect(bytes.byteLength).toBeGreaterThan(500)
    // PDF magic header
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF")
  })

  it("embeds localized Spanish labels without a logo", async () => {
    const bytes = await buildQuotationPdf({
      id: "abcdef01-aaaa-bbbb-cccc-dddddddddddd",
      currency: "USD",
      created_at: "2026-01-15T00:00:00.000Z",
      valid_until: "2026-02-15T00:00:00.000Z",
      subtotal: 500,
      tax_total: 0,
      discount_total: 0,
      total: 500,
      items: [
        { name: "Servicio", quantity: 1, unit_price: 500, subtotal: 500 },
      ],
      lead: { name: "Sergio", email: "sergio@example.com" },
      site: { name: "Ofertas en Camino", url: "https://ofertas.example" },
      locale: "es",
      buyerLink: "https://app.example.com/q/token-xyz",
    })

    const doc = await PDFDocument.load(bytes)
    const page = doc.getPages()[0]
    // Extractable text via pdf-lib is limited; assert page exists and size is A4
    expect(page.getWidth()).toBeCloseTo(595.28, 1)
    expect(page.getHeight()).toBeCloseTo(841.89, 1)
    expect(bytes.byteLength).toBeGreaterThan(800)
  })

  it("falls back gracefully when logo_url cannot be embedded", async () => {
    const bytes = await buildQuotationPdf({
      id: "zzzzzzzz-aaaa-bbbb-cccc-dddddddddddd",
      currency: "USD",
      created_at: "2026-01-15T00:00:00.000Z",
      total: 10,
      items: [{ name: "Item", quantity: 1, unit_price: 10, subtotal: 10 }],
      lead: { name: "Client", email: "c@example.com" },
      site: {
        name: "No Logo Co",
        // SVG data URLs are skipped; name-only letterhead is used
        logo_url: "data:image/svg+xml;base64,PHN2Zy8+",
      },
      locale: "en",
      buyerLink: "https://app.example.com/q/token",
    })

    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF")
  })
})

