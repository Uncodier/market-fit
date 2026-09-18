import {
  assertQuotationCheckoutable,
  assertQuotationRejectable,
  buildQuoteCheckoutPath,
  claimQuotationCheckout,
  completeQuotationCheckout,
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

    it("rejects an authenticated user when the quote has no assigned buyer", () => {
      const gate = assertQuotationCheckoutable(
        { ...baseQuote, buyer_user_id: null },
        { buyerUserId: "arbitrary-user" }
      )
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/authorized/i)
    })

    it("allows an unassigned quote when an active public token was validated", () => {
      const gate = assertQuotationCheckoutable(
        { ...baseQuote, buyer_user_id: null },
        { buyerUserId: "arbitrary-user", publicAccess: true }
      )
      expect(gate).toEqual({ ok: true })
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

    it("rejects an authenticated user when the quote has no assigned buyer", () => {
      const gate = assertQuotationRejectable(
        { ...baseQuote, buyer_user_id: null },
        { buyerUserId: "arbitrary-user" }
      )
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.error).toMatch(/authorized/i)
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

  describe("checkout claims", () => {
    it("passes authenticated identity and public token to the atomic claim", async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: [{ result: "claimed", sale_id: null, order_id: null }],
        error: null,
      })

      await expect(claimQuotationCheckout({ rpc }, {
        quotationId: "q-1",
        siteId: "site-1",
        claimId: "claim-1",
        buyerUserId: "buyer-1",
        publicAccessToken: "0123456789abcdefghijklmn",
      })).resolves.toEqual({
        state: "claimed",
        saleId: null,
        orderId: null,
      })
      expect(rpc).toHaveBeenCalledWith("claim_quotation_checkout", {
        p_quotation_id: "q-1",
        p_site_id: "site-1",
        p_claim_id: "claim-1",
        p_buyer_user_id: "buyer-1",
        p_public_access_token: "0123456789abcdefghijklmn",
      })
    })

    it("returns existing artifacts for an already completed checkout", async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: [{
          result: "completed",
          sale_id: "sale-1",
          order_id: "order-1",
        }],
        error: null,
      })

      await expect(claimQuotationCheckout({ rpc }, {
        quotationId: "q-1",
        siteId: "site-1",
        claimId: "claim-2",
      })).resolves.toEqual({
        state: "completed",
        saleId: "sale-1",
        orderId: "order-1",
      })
    })

    it("only completes through the claim-bound RPC", async () => {
      const rpc = jest.fn().mockResolvedValue({ data: true, error: null })

      await expect(completeQuotationCheckout({ rpc }, {
        quotationId: "q-1",
        claimId: "claim-1",
        saleId: "sale-1",
        orderId: "order-1",
      })).resolves.toEqual({ success: true })
      expect(rpc).toHaveBeenCalledWith("complete_quotation_checkout", {
        p_quotation_id: "q-1",
        p_claim_id: "claim-1",
        p_sale_id: "sale-1",
        p_order_id: "order-1",
      })
    })
  })
})
