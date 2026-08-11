import {
  assertQuotationCheckoutable,
  assertQuotationRejectable,
  buildQuoteCheckoutPath,
  isQuotationExpired,
  mapQuotationToCartItems,
  quotationItemsToCheckoutLines,
} from "@/app/quotations/quote-checkout"

describe("quote checkout helpers", () => {
  const baseQuote = {
    id: "q-1",
    site_id: "site-1",
    status: "sent",
    valid_until: "2099-01-01T00:00:00.000Z",
    buyer_user_id: "buyer-1",
    items: [
      {
        catalog_item_id: "item-1",
        name: "Widget",
        quantity: 2,
        unit_price: 12.5,
        catalog_item: {
          site_id: "site-1",
          name: "Widget",
          kind: "product",
          currency: "USD",
          metadata: { payment_options: ["card"] },
        },
      },
    ],
  }

  describe("isQuotationExpired", () => {
    it("returns false when valid_until is missing", () => {
      expect(isQuotationExpired(null)).toBe(false)
    })

    it("returns true when valid_until is in the past", () => {
      expect(isQuotationExpired("2020-01-01T00:00:00.000Z", new Date("2024-01-01"))).toBe(true)
    })
  })

  describe("assertQuotationCheckoutable", () => {
    it("allows a sent quote for the owning buyer", () => {
      const gate = assertQuotationCheckoutable(baseQuote, { buyerUserId: "buyer-1", siteId: "site-1" })
      expect(gate).toEqual({ ok: true })
    })

    it("rejects non-sent status", () => {
      const gate = assertQuotationCheckoutable(
        { ...baseQuote, status: "draft" },
        { buyerUserId: "buyer-1" }
      )
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/sent status/i)
    })

    it("rejects expired quotes", () => {
      const gate = assertQuotationCheckoutable(
        { ...baseQuote, valid_until: "2020-01-01T00:00:00.000Z" },
        { buyerUserId: "buyer-1", now: new Date("2024-01-01") }
      )
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/expired/i)
    })

    it("rejects unauthorized buyers", () => {
      const gate = assertQuotationCheckoutable(baseQuote, { buyerUserId: "other" })
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/authorized/i)
    })

    it("requires login", () => {
      const gate = assertQuotationCheckoutable(baseQuote, { buyerUserId: null })
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/logged in/i)
    })
  })

  describe("assertQuotationRejectable", () => {
    it("allows reject for sent quote owner", () => {
      expect(assertQuotationRejectable(baseQuote, { buyerUserId: "buyer-1" })).toEqual({ ok: true })
    })

    it("rejects when status is not sent", () => {
      const gate = assertQuotationRejectable(
        { ...baseQuote, status: "accepted" },
        { buyerUserId: "buyer-1" }
      )
      expect(gate.ok).toBe(false)
    })
  })

  describe("quotationItemsToCheckoutLines", () => {
    it("maps quoted unit prices as overrides", () => {
      expect(quotationItemsToCheckoutLines(baseQuote.items)).toEqual([
        {
          catalogItemId: "item-1",
          quantity: 2,
          unitPriceOverride: 12.5,
        },
      ])
    })
  })

  describe("mapQuotationToCartItems", () => {
    it("builds cart items with quoted cartPrice", () => {
      const items = mapQuotationToCartItems(baseQuote)
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe("item-1")
      expect(items[0].cartQty).toBe(2)
      expect(items[0].cartPrice).toBe(12.5)
      expect(items[0].target_sale_price).toBe(12.5)
      expect(items[0].metadata).toEqual({ payment_options: ["card"] })
    })
  })

  describe("buildQuoteCheckoutPath", () => {
    it("includes buynow mode and quotationId", () => {
      const path = buildQuoteCheckoutPath({
        siteId: "site-1",
        quotationId: "q-1",
        returnTo: "/buyer",
        ownerSiteId: "owner-1",
      })
      expect(path).toContain("/cart/checkout?")
      expect(path).toContain("mode=buynow")
      expect(path).toContain("quotationId=q-1")
      expect(path).toContain("ownerSiteId=owner-1")
      expect(path).toContain("returnTo=%2Fbuyer")
    })
  })
})
