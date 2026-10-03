/** @jest-environment node */
import { processCheckoutLines } from "@/app/commerce/checkout-lines"
import type { CheckoutLine } from "@/app/commerce/checkout-types"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { resolveUnitPrice } from "@/app/price-lists/actions"
import { checkoutStockClient, stockFixture, stockItem, type StockFixture } from "./helpers/checkout-stock-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn().mockResolvedValue({ data: {} }) }))
jest.mock("@/app/commerce/pass-round-robin-server", () => ({ assertCommerceReservationSlot: jest.fn() }))
jest.mock("@/app/price-lists/actions", () => ({ resolveUnitPrice: jest.fn().mockResolvedValue({ price: 10 }) }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: jest.fn() }))

describe("checkout stock revalidation", () => {
  let fixture: StockFixture
  let client: ReturnType<typeof checkoutStockClient>
  beforeEach(() => {
    jest.clearAllMocks()
    fixture = stockFixture()
    fixture.items.push(stockItem("host", { availability_mode: "always" }))
    client = checkoutStockClient(fixture)
    jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
    jest.mocked(createServiceClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createServiceClient>>)
  })

  const process = (lines: CheckoutLine[], priceListChannel = "pos") => processCheckoutLines({
    supabase: client, supabaseAdmin: client, siteId: "site", lines,
    isAdmin: false, isStaffCheckout: true, siteSettings: {
      currency: "USD", commerce: { stock_shortage_policy: "allow" },
    },
    priceListChannel, originLocationId: "origin", fulfillment: "none",
  })

  it("blocks repeated host lines whose combined demand exceeds current backend stock", async () => {
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    await expect(process([
      { catalogItemId: "sku", quantity: 3 },
      { catalogItemId: "sku", quantity: 3 },
    ])).rejects.toThrow("requested 6, available 5")
    expect(resolveUnitPrice).not.toHaveBeenCalled()
  })

  it.each(["allow", "warn"])("allocates %s shortage sequentially and ignores forged client metadata", async (policy) => {
    fixture.settings = { commerce: { stock_shortage_policy: policy } }
    const lines = [
      { catalogItemId: "sku", quantity: 3, backorder_quantity: 99, metadata: { backorder_quantity: 99 }, availableQty: 100 },
      { catalogItemId: "sku", quantity: 4, backorder_quantity: 0, metadata: { backorder_quantity: 0 } },
      { catalogItemId: "sku", quantity: 2 },
    ]
    const result = await process(lines)
    expect(result.processedLines.map((line) => line.backorder_quantity)).toEqual([0, 2, 2])
    expect(result.orderSubtotal).toBe(90)
    const inventoryReads = client.reads.filter((read) => read.table === "inventory_levels")
    expect(inventoryReads).toEqual([{ table: "inventory_levels", filters: {
      catalog_item_id: "sku", site_id: "site", location_id: "origin",
    } }])
  })

  const repeatedModifiers = (): CheckoutLine[] => [
    { catalogItemId: "host", quantity: 2, modifiers: [
      { catalogItemId: "sku", quantity: 2, groupId: "first" },
      { catalogItemId: "sku", quantity: 1, groupId: "second" },
    ] },
    { catalogItemId: "host", quantity: 3, modifiers: [{ catalogItemId: "sku", quantity: 1 }] },
  ]

  it("blocks totals of duplicate modifiers within and across multiplicative hosts", async () => {
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    await expect(process(repeatedModifiers())).rejects.toThrow("requested 9, available 5")
  })

  it("allocates duplicated modifier demand in flattened host/modifier order", async () => {
    const { processedLines } = await process(repeatedModifiers())
    expect(processedLines.map((line) => line.quantity)).toEqual([2, 4, 2, 3, 3])
    expect(processedLines.map((line) => line.backorder_quantity)).toEqual([0, 0, 1, 0, 3])
    expect(processedLines[1].parent_client_line_key).toBe(processedLines[0].client_line_key)
  })

  it("shares one SKU's inventory between host and modifier demand", async () => {
    const lines = [
      { catalogItemId: "sku", quantity: 3 },
      { catalogItemId: "host", quantity: 2, modifiers: [{ catalogItemId: "sku", quantity: 2 }] },
    ]
    expect((await process(lines)).processedLines.map((line) => line.backorder_quantity)).toEqual([0, 0, 2])
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    await expect(process(lines)).rejects.toThrow("requested 7, available 5")
  })

  it("does not let a modifier bypass variant checks for the same host SKU", async () => {
    fixture.items[0].is_purchasable = false
    await expect(process([
      { catalogItemId: "host", quantity: 1, modifiers: [{ catalogItemId: "sku", quantity: 1 }] },
      { catalogItemId: "sku", quantity: 1 },
    ])).rejects.toThrow("variant")
  })

  it("re-reads stock and policy on every request", async () => {
    const lines = [{ catalogItemId: "sku", quantity: 3 }]
    expect((await process(lines)).processedLines[0].backorder_quantity).toBe(0)
    fixture.levels[0].quantity = 1
    expect((await process(lines)).processedLines[0].backorder_quantity).toBe(2)
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    await expect(process(lines)).rejects.toThrow("Insufficient stock")
  })

  it.each(["settingsError", "inventoryError"] as const)("does not checkout on %s even for block policy", async (key) => {
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    fixture[key] = true
    await expect(process([{ catalogItemId: "sku", quantity: 1 }])).rejects.toThrow("Unable to verify")
    expect(resolveUnitPrice).not.toHaveBeenCalled()
  })

  it.each([0, -1, NaN, Infinity, -Infinity, "2"])("rejects invalid host and modifier quantity %s", async (quantity) => {
    await expect(process([{ catalogItemId: "sku", quantity: quantity as number }])).rejects.toThrow("positive finite")
    await expect(process([{ catalogItemId: "host", quantity: 1, modifiers: [
      { catalogItemId: "sku", quantity: quantity as number },
    ] }])).rejects.toThrow("positive finite")
    expect(client.from).not.toHaveBeenCalled()
  })

  it("rejects overflowed modifier products and aggregate totals before database reads", async () => {
    await expect(process([{ catalogItemId: "host", quantity: Number.MAX_VALUE, modifiers: [
      { catalogItemId: "sku", quantity: 2 },
    ] }])).rejects.toThrow("positive finite")
    await expect(process([
      { catalogItemId: "sku", quantity: Number.MAX_VALUE },
      { catalogItemId: "sku", quantity: Number.MAX_VALUE },
    ])).rejects.toThrow("positive finite")
    expect(client.from).not.toHaveBeenCalled()
  })

  it("supports positive fractional quantities and clamps negative stock coverage to zero", async () => {
    fixture.levels[0].quantity = 0.75
    expect((await process([{ catalogItemId: "sku", quantity: 1.25 }])).processedLines[0].backorder_quantity).toBe(0.5)
    fixture.levels[0].quantity = -2
    expect((await process([{ catalogItemId: "sku", quantity: 1.25 }])).processedLines[0].backorder_quantity).toBe(1.25)
  })

  it("leaves non-POS per-line checks and metadata unchanged", async () => {
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    const { processedLines } = await process([
      { catalogItemId: "sku", quantity: 4 },
      { catalogItemId: "sku", quantity: 4 },
    ], "shop")
    for (const line of processedLines) expect(line).not.toHaveProperty("backorder_quantity")
    expect(client.reads.filter((read) => read.table === "inventory_levels")).toHaveLength(2)
    await expect(process([{ catalogItemId: "sku", quantity: 0 }], "shop")).rejects.toThrow("positive finite")
  })
})