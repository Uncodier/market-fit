import {
  buildDocumentEmailHtml,
  buildDocumentEmailSubject,
  buildDocumentSendGridPayload,
} from "@/app/documents/send-document-email"
import { buildDocumentPdf } from "@/app/documents/document-pdf"

describe("document email builders", () => {
  it("builds sales invoice HTML and subject", () => {
    const html = buildDocumentEmailHtml({
      toName: "Ada",
      siteName: "Acme",
      docRef: "INV-1",
      totalLabel: "$100.00",
      viewLink: "https://app.example.com/i/token",
      i18nPrefix: "sales",
      locale: "en",
    })
    expect(html).toContain("Hi Ada,")
    expect(html).toContain("View invoice")
    expect(html).toContain("#INV-1")

    const subject = buildDocumentEmailSubject({
      siteName: "Acme",
      docRef: "INV-1",
      i18nPrefix: "sales",
      locale: "en",
    })
    expect(subject).toContain("Invoice #INV-1")
  })

  it("builds orders and bills subjects", () => {
    expect(
      buildDocumentEmailSubject({
        siteName: "Acme",
        docRef: "SO-1",
        i18nPrefix: "orders",
        locale: "en",
      })
    ).toContain("Order #SO-1")
    expect(
      buildDocumentEmailSubject({
        siteName: "Acme",
        docRef: "BILL-1",
        i18nPrefix: "bills",
        locale: "en",
      })
    ).toContain("Bill #BILL-1")
  })

  it("localizes sales, orders, and bills emails to Spanish site locale", () => {
    const salesHtml = buildDocumentEmailHtml({
      toName: "Sergio",
      siteName: "Acme",
      docRef: "INV-9",
      totalLabel: "$75.00",
      viewLink: "https://app.example.com/i/token",
      i18nPrefix: "sales",
      locale: "es",
    })
    expect(salesHtml).toContain('lang="es"')
    expect(salesHtml).toContain("Hola Sergio,")
    expect(salesHtml).toContain("Ver factura")
    expect(
      buildDocumentEmailSubject({
        siteName: "Acme",
        docRef: "INV-9",
        i18nPrefix: "sales",
        locale: "es",
      })
    ).toContain("Factura #INV-9")

    const ordersHtml = buildDocumentEmailHtml({
      toName: "Sergio",
      siteName: "Acme",
      docRef: "ORD-1",
      totalLabel: "$75.00",
      viewLink: "https://app.example.com/so/token",
      i18nPrefix: "orders",
      locale: "es",
    })
    expect(ordersHtml).toContain("Ver orden")
    expect(
      buildDocumentEmailSubject({
        siteName: "Acme",
        docRef: "ORD-1",
        i18nPrefix: "orders",
        locale: "es",
      })
    ).toContain("Orden #ORD-1")

    expect(
      buildDocumentEmailSubject({
        siteName: "Acme",
        docRef: "BILL-1",
        i18nPrefix: "bills",
        locale: "es",
      })
    ).toContain("Factura de compra #BILL-1")
  })

  it("builds SendGrid payload with PDF attachment", () => {
    const payload = buildDocumentSendGridPayload({
      toEmail: "a@example.com",
      toName: "A",
      fromEmail: "from@example.com",
      fromName: "Acme",
      subject: "Invoice #1",
      siteName: "Acme",
      docRef: "1",
      totalLabel: "$10",
      viewLink: "https://x.test/i/t",
      pdfBase64: "AAAA",
      pdfFilename: "invoice-1.pdf",
      apiKey: "sg",
      i18nPrefix: "sales",
    })
    expect(payload.attachments[0].filename).toBe("invoice-1.pdf")
    expect(payload.content.some((c) => c.type === "text/html")).toBe(true)
  })
})

describe("buildDocumentPdf", () => {
  it("returns a PDF for a simple invoice", async () => {
    const bytes = await buildDocumentPdf({
      docKindLabel: "Invoice",
      docRef: "abcd1234",
      currency: "USD",
      created_at: "2026-01-01T00:00:00.000Z",
      total: 50,
      subtotal: 50,
      items: [{ name: "Item", quantity: 1, unit_price: 50, subtotal: 50 }],
      party: { name: "Client", email: "c@example.com" },
      site: { name: "Acme", url: "https://acme.test" },
      viewLink: "https://app.example.com/i/token",
      locale: "en",
    })
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF")
    expect(bytes.byteLength).toBeGreaterThan(500)
  })
})
