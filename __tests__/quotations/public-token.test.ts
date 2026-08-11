import {
  buildPublicQuotePath,
  buildPublicQuoteUrl,
  generateQuotationPublicToken,
  isValidQuotationPublicToken,
} from "@/app/quotations/public-token"
import {
  assertQuotationCheckoutable,
  assertQuotationRejectable,
} from "@/app/quotations/quote-checkout"

describe("quotation public token", () => {
  it("generates a valid URL-safe token", () => {
    const token = generateQuotationPublicToken()
    expect(isValidQuotationPublicToken(token)).toBe(true)
    expect(token).not.toContain("+")
    expect(token).not.toContain("/")
  })

  it("rejects short or invalid tokens", () => {
    expect(isValidQuotationPublicToken("abc")).toBe(false)
    expect(isValidQuotationPublicToken("")).toBe(false)
    expect(isValidQuotationPublicToken(null)).toBe(false)
  })

  it("builds public quote paths", () => {
    expect(buildPublicQuotePath("tok_abc")).toBe("/q/tok_abc")
    expect(buildPublicQuoteUrl("tok_abc", "https://app.example.com")).toBe(
      "https://app.example.com/q/tok_abc"
    )
  })

  it("allows guest checkout when publicAccess is true", () => {
    const quote = {
      site_id: "site-1",
      status: "sent",
      valid_until: "2099-01-01T00:00:00.000Z",
      buyer_user_id: null,
      items: [{ catalog_item_id: "i1", name: "A", quantity: 1, unit_price: 10 }],
    }
    expect(assertQuotationCheckoutable(quote, { publicAccess: true })).toEqual({ ok: true })
    expect(assertQuotationRejectable(quote, { publicAccess: true })).toEqual({ ok: true })
  })

  it("still requires login without publicAccess", () => {
    const quote = {
      site_id: "site-1",
      status: "sent",
      valid_until: "2099-01-01T00:00:00.000Z",
      buyer_user_id: null,
      items: [{ catalog_item_id: "i1", name: "A", quantity: 1, unit_price: 10 }],
    }
    const gate = assertQuotationCheckoutable(quote, { buyerUserId: null })
    expect(gate.ok).toBe(false)
  })
})
