import {
  buildQuotationEmailHtml,
  buildQuotationEmailSubject,
  buildSendGridMailPayload,
} from "@/app/quotations/send-quotation-email"
import { uint8ToBase64 } from "@/app/quotations/quotation-pdf"

describe("send quotation email helpers", () => {
  it("builds HTML with quote ref, total, and buyer link", () => {
    const html = buildQuotationEmailHtml({
      toName: "Ada",
      siteName: "Acme",
      quoteRef: "abcd1234",
      totalLabel: "$120.00",
      buyerLink: "https://app.example.com/buyer/quotes/q1",
    })
    expect(html).toContain("Hi Ada,")
    expect(html).toContain("#abcd1234")
    expect(html).toContain("$120.00")
    expect(html).toContain("https://app.example.com/buyer/quotes/q1")
    expect(html).toContain("View quote")
  })

  it("builds localized Spanish HTML and subject", () => {
    const html = buildQuotationEmailHtml({
      toName: "Sergio",
      siteName: "Ofertas en Camino",
      quoteRef: "facf1cf0",
      totalLabel: "$500.00",
      buyerLink: "https://app.example.com/q/token",
      locale: "es",
    })
    expect(html).toContain("Hola Sergio,")
    expect(html).toContain("Ver cotización")
    expect(html).toContain("#facf1cf0")

    const subject = buildQuotationEmailSubject({
      siteName: "Ofertas en Camino",
      quoteRef: "facf1cf0",
      locale: "es",
    })
    expect(subject).toContain("Cotización #facf1cf0")
    expect(subject).toContain("Ofertas en Camino")
  })

  it("builds SendGrid payload with PDF attachment", () => {
    const payload = buildSendGridMailPayload({
      toEmail: "client@example.com",
      toName: "Client",
      fromEmail: "quotes@example.com",
      fromName: "Acme",
      subject: "Quote #abcd1234 from Acme",
      siteName: "Acme",
      quoteRef: "abcd1234",
      totalLabel: "$120.00",
      buyerLink: "https://app.example.com/buyer/quotes/q1",
      pdfBase64: "AAAA",
      pdfFilename: "quote-abcd1234.pdf",
      apiKey: "sg-test",
    })

    expect(payload.personalizations[0].to[0].email).toBe("client@example.com")
    expect(payload.from.email).toBe("quotes@example.com")
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments[0]).toMatchObject({
      content: "AAAA",
      filename: "quote-abcd1234.pdf",
      type: "application/pdf",
      disposition: "attachment",
    })
    expect(payload.content.some((c) => c.type === "text/html")).toBe(true)
  })

  it("encodes pdf bytes to base64", () => {
    expect(uint8ToBase64(new Uint8Array([1, 2, 3]))).toBe(
      Buffer.from([1, 2, 3]).toString("base64")
    )
  })
})
