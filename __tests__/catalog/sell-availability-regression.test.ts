/** @jest-environment node */
import { assertCanSell, getCatalogAvailability } from "@/app/catalog/sell-availability"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { checkoutStockClient, stockFixture, type StockFixture } from "../commerce/helpers/checkout-stock-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))

describe("backend catalog stock revalidation", () => {
  let fixture: StockFixture
  let client: ReturnType<typeof checkoutStockClient>
  beforeEach(() => {
    jest.clearAllMocks()
    fixture = stockFixture()
    client = checkoutStockClient(fixture)
    jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
    jest.mocked(createServiceClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createServiceClient>>)
  })

  it.each(["allow", "warn", "block"])("uses the stored %s policy", async (policy) => {
    fixture.settings = { commerce: { stock_shortage_policy: policy } }
    await expect(getCatalogAvailability("site", "sku", 6, "origin")).resolves.toMatchObject({
      sellable: policy !== "block", policy, availableQty: 5,
    })
  })

  it.each([null, {}, { commerce: null }, { commerce: {} }])("defaults missing policy to allow: %j", async (settings) => {
    fixture.settings = settings
    await expect(getCatalogAvailability("site", "sku", 6)).resolves.toMatchObject({ sellable: true, policy: "allow" })
  })

  it("does not turn a settings error into allow, even with partial data", async () => {
    fixture.settingsError = true
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Unable to verify stock policy")
  })

  it("fails closed when the policy cannot be interpreted", async () => {
    fixture.settings = { commerce: { stock_shortage_policy: "invalid" } }
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Invalid stock shortage policy")
  })

  it.each(["allow", "warn", "block"])("fails closed on inventory errors under %s", async (policy) => {
    fixture.settings = { commerce: { stock_shortage_policy: policy } }
    fixture.inventoryError = true
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Unable to verify inventory")
  })

  it("fails closed on a missing inventory response", async () => {
    fixture.inventoryMissing = true
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Unable to verify inventory")
  })

  it.each([NaN, Infinity, "bad", "", null, undefined])("rejects unreadable inventory %s", async (quantity) => {
    fixture.levels[0].quantity = quantity
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Unable to verify inventory")
  })

  it.each([0, -1, NaN, Infinity, -Infinity, "2"])("rejects invalid requested quantity %s before reading", async (quantity) => {
    await expect(assertCanSell("site", "sku", quantity as number)).rejects.toThrow("positive finite")
    expect(createClient).not.toHaveBeenCalled()
  })

  it("restricts selected locations and otherwise totals all site inventory", async () => {
    fixture.levels.push(
      { site_id: "site", catalog_item_id: "sku", location_id: "other", quantity: "7" },
      { site_id: "foreign", catalog_item_id: "sku", location_id: "origin", quantity: 100 },
    )
    expect((await getCatalogAvailability("site", "sku", 6, "origin")).availableQty).toBe(5)
    expect((await getCatalogAvailability("site", "sku", 6)).availableQty).toBe(12)
    expect((await getCatalogAvailability("site", "sku", 6, "empty")).availableQty).toBe(0)
  })

  it("uses availability_mode, not track_inventory", async () => {
    fixture.settings = { commerce: { stock_shortage_policy: "block" } }
    fixture.items[0].track_inventory = false
    await expect(assertCanSell("site", "sku", 6)).rejects.toThrow("Insufficient stock")
    fixture.items[0].availability_mode = "always"
    fixture.items[0].track_inventory = true
    fixture.inventoryError = true
    await expect(assertCanSell("site", "sku", 6)).resolves.toMatchObject({ sellable: true })
  })

  it("preserves archived, manual, and variant guards", async () => {
    fixture.items[0].status = "archived"
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("archived")
    fixture.items[0].status = "active"
    fixture.items[0].availability_mode = "manual"
    fixture.items[0].availability_status = "unavailable"
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("marked as unavailable")
    fixture.items[0].availability_mode = "always"
    fixture.childCount = 2
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("variant")
    fixture.variantError = true
    await expect(assertCanSell("site", "sku", 1)).rejects.toThrow("Unable to verify item variants")
  })

  it("keeps user-scoped access unless explicitly requested by its authorized caller", async () => {
    await assertCanSell("site", "sku", 1)
    expect(createServiceClient).not.toHaveBeenCalled()
    await assertCanSell("site", "sku", 1, undefined, true)
    expect(createServiceClient).toHaveBeenCalledWith(true)
    await expect(assertCanSell("foreign", "sku", 1)).rejects.toThrow("Item not found")
  })
})