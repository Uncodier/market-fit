/** @jest-environment node */

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { getDemoData } from "@/lib/demo-data"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"
import { pullPosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot"
import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision"
import { readThroughJsonCache } from "@/lib/redis/json-cache"
import { listAllModifierGroupsForPos } from "@/app/catalog/modifier-actions"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  hashRedisKeyPart: jest.fn(async (value: string) => value),
}))
jest.mock("@/lib/redis/json-cache", () => ({ readThroughJsonCache: jest.fn() }))

describe("POS snapshots using the real demo client and catalog actions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createServiceClient).mockRejectedValue(new Error("Demo reads must not access real Supabase"))
    jest.mocked(readThroughJsonCache).mockImplementation(async ({ compute }) => (
      { status: "computed", value: await compute() }
    ))
  })

  it.each([
    ["demo-habituall", 4, 2, "Studio POS", 0],
    ["demo-saas-en-123", 1, 1, "Standard", 0],
    ["demo-ecom-es-456", 8, 2, "Retail", 7],
  ] as const)("loads the full POS snapshot for %s", async (siteId, itemCount, locationCount, priceList, stockRows) => {
    const client = createDemoMockClient(siteId)
    jest.mocked(createClient).mockResolvedValue(client)
    const revision = await getPosCatalogRevision(siteId)
    expect(revision).toEqual({ data: expect.any(String) })

    const result = await pullPosCatalogSnapshot(siteId, "data" in revision ? revision.data : null)
    expect(result).toEqual({ data: expect.any(Object) })
    if (!("data" in result)) throw new Error(result.error)
    const snapshot = result.data
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(snapshot.catalogItems).toHaveLength(itemCount)
    expect(snapshot.catalogItems.every((item) => item.site_id === siteId && item.status === "active")).toBe(true)
    expect(snapshot.locations).toHaveLength(locationCount)
    expect(snapshot.locations.some((location) => location.is_default)).toBe(true)
    expect(snapshot.priceLists.map((list) => list.name)).toEqual([priceList])
    for (const item of snapshot.catalogItems) {
      expect(snapshot.priceListItems).toContainEqual(expect.objectContaining({
        catalog_item_id: item.id,
        unit_price: item.target_sale_price,
      }))
    }
    expect(snapshot.inventorySnapshot.levels).toHaveLength(stockRows)
    expect(snapshot.inventorySnapshot.policy).toBe("allow")
    if (siteId === "demo-ecom-es-456") {
      expect(snapshot.inventorySnapshot.levels.reduce((total, row) => total + row.quantity, 0)).toBe(152)
      expect(snapshot.promotions.some((promo) => promo.code === "VERANO20")).toBe(true)
    }
    if (siteId !== "demo-saas-en-123") {
      expect(snapshot.taxesByItem[snapshot.catalogItems[0].id]).toContainEqual(expect.objectContaining({ rate: 16 }))
    }
  })

  it.each(["demo-ecom-es-456", "11111111-1111-4111-8111-111111111111"])(
    "denies %s before reading or caching data for another demo", async (foreignId) => {
      jest.mocked(createClient).mockResolvedValue(createDemoMockClient("demo-habituall"))
      expect(await pullPosCatalogSnapshot(foreignId)).toEqual({ error: "Forbidden" })
      expect(readThroughJsonCache).not.toHaveBeenCalled()
    },
  )

  it("preserves the unauthenticated POS gate", async () => {
    jest.mocked(createClient).mockResolvedValue(createDemoMockClient("demo-missing"))
    expect(await requirePosSiteAccess("demo-missing")).toEqual({ error: "Not authenticated" })
    expect(readThroughJsonCache).not.toHaveBeenCalled()
  })

  it("denies direct modifier reads for a foreign site before using the service client", async () => {
    jest.mocked(createClient).mockResolvedValue(createDemoMockClient("demo-habituall"))
    expect(await listAllModifierGroupsForPos("demo-ecom-es-456")).toEqual({ data: {}, error: "Forbidden" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("keeps the demo fixture owner's identity consistent", async () => {
    const siteId = "demo-habituall"
    jest.mocked(createClient).mockResolvedValue(createDemoMockClient(siteId))
    const access = await requirePosSiteAccess(siteId)
    expect(access).toEqual(expect.objectContaining({
      role: "owner",
      user: expect.objectContaining({ id: (await getDemoData(siteId))?.sites[0].user_id }),
    }))
  })
})