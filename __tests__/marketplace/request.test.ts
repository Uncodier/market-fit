/** @jest-environment node */
import { readMarketplaceBody, marketplaceActionSchema, assertSameOrigin } from "@/lib/marketplace/request"

describe("marketplace request boundary", () => {
  it("bounds streamed bodies even without Content-Length", async () => {
    const request = new Request("https://orders.example.test/webhook", { method: "POST", body: "abcdef" })
    await expect(readMarketplaceBody(request, 4)).rejects.toMatchObject({ status: 413 })
  })
  it("validates explicit operator actions and reasons", () => {
    expect(marketplaceActionSchema.safeParse({ action: "reject" }).success).toBe(false)
    expect(marketplaceActionSchema.safeParse({ action: "accept", cooking_time_minutes: 0 }).success).toBe(false)
    expect(marketplaceActionSchema.safeParse({ action: "accept", site_id: "forged" }).success).toBe(false)
    expect(marketplaceActionSchema.safeParse({ action: "reject", reason: "Out of stock" }).success).toBe(true)
  })
  it("rejects cross-origin browser mutations", () => {
    expect(() => assertSameOrigin(new Request("https://orders.example.test/action", {
      headers: { origin: "https://other.example.test" },
    }))).toThrow("Forbidden")
    expect(() => assertSameOrigin(new Request("https://orders.example.test/action", {
      headers: { origin: "https://orders.example.test" },
    }))).not.toThrow()
  })
})