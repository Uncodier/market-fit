import fs from "node:fs"
import path from "node:path"
import { toBuyerQuoteDto } from "@/app/buyer/quote-dto"

describe("buyer quote DTO", () => {
  it("uses an explicit quotation projection without wildcard fields", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/buyer/quote-actions.ts"),
      "utf8"
    )
    const select = source.match(
      /const BUYER_QUOTE_SELECT = `([\s\S]*?)`/
    )?.[1]

    expect(select).toBeDefined()
    expect(select).not.toMatch(/(^|[,(]\s*)\*(?=\s*[,)\n])/m)
    expect(select).not.toContain("buyer_user_id")
    expect(select).not.toContain("deal:")
  })

  it("removes internal fields and non-checkout catalog metadata", () => {
    const dto = toBuyerQuoteDto({
      id: "quote-1",
      site_id: "site-1",
      title: "Quote",
      status: "sent",
      valid_until: null,
      currency: "USD",
      notes: null,
      subtotal: 10,
      discount_total: 0,
      tax_total: 0,
      total: 10,
      created_at: "2026-09-17T12:00:00.000Z",
      internal_notes: "never expose",
      buyer_user_id: "buyer-1",
      items: [{
        id: "line-1",
        catalog_item_id: "item-1",
        name: "Item",
        quantity: 1,
        unit_price: 10,
        subtotal: 10,
        catalog_item: {
          name: "Item",
          image_url: null,
          kind: "product",
          currency: "USD",
          metadata: {
            payment_options: ["card"],
            supplier_cost: 2,
            private_prompt: "secret",
          },
        },
      }],
      lead: {
        id: "lead-1",
        name: "Buyer",
        email: "buyer@example.com",
        private_notes: "secret",
      },
      site: { id: "site-1", name: "Store", logo_url: null, url: null },
    })

    expect(dto).not.toHaveProperty("internal_notes")
    expect(dto).not.toHaveProperty("buyer_user_id")
    expect(dto.lead).toEqual({ name: "Buyer", email: "buyer@example.com" })
    expect(dto.items[0].catalog_item?.metadata).toEqual({
      payment_options: ["card"],
    })
  })
})
