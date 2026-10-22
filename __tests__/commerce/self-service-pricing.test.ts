/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/app/price-lists/apply-channel-prices", () => ({ loadChannelPriceMap: jest.fn() }))
import { loadSelfServicePricing } from "@/app/commerce/self-service-pricing"
import { loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices"

function setup(error: unknown = null, rate = 16) {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [{ catalog_item_id: "item", tax: { id: "tax", is_active: true, rate } }, { catalog_item_id: "item", tax: { is_active: false, rate: 100 } }], error }) }
  const client = { from: jest.fn(() => query) }
  ;(loadChannelPriceMap as jest.Mock).mockResolvedValue({ priceByItemId: new Map([["item", 12]]), currencyBySiteId: new Map([["site", "MXN"]]), listIdBySiteId: new Map() })
  return { client, query }
}

it("uses the authorized Shop channel client and scoped tax rows, never ambient RLS/session", async () => {
  const { client, query } = setup()
  const result = await loadSelfServicePricing(client, "site", ["item", "item"])
  expect(loadChannelPriceMap).toHaveBeenCalledWith(client, ["site"], "shop", ["item"])
  expect(query.eq).toHaveBeenCalledWith("site_id", "site")
  expect(result.priceByItemId.get("item")).toBe(12)
  expect(result.currencyBySiteId.get("site")).toBe("MXN")
  expect(result.taxesByItem.item).toHaveLength(1)
})

it("fails closed for tax query errors or invalid persisted tax rates", async () => {
  await expect(loadSelfServicePricing(setup({ message: "database unavailable" }).client, "site", ["item"])).rejects.toThrow("verify checkout taxes")
  await expect(loadSelfServicePricing(setup(null, -1).client, "site", ["item"])).rejects.toThrow("Invalid checkout tax")
})