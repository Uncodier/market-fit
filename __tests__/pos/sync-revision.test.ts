/** @jest-environment node */

import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"
import { hashRedisKeyPart } from "@/lib/redis/control-plane"
import { readThroughJsonCache } from "@/lib/redis/json-cache"

jest.mock("@/app/pos/actions/site-access", () => ({
  requirePosSiteAccess: jest.fn(),
}))

jest.mock("@/lib/redis/control-plane", () => ({
  hashRedisKeyPart: jest.fn(),
}))

jest.mock("@/lib/redis/json-cache", () => ({
  readThroughJsonCache: jest.fn(),
}))

const requirePosSiteAccessMock = requirePosSiteAccess as jest.Mock
const hashRedisKeyPartMock = hashRedisKeyPart as jest.Mock
const readThroughJsonCacheMock = readThroughJsonCache as jest.Mock

const timestamps: Record<string, string> = {
  catalog_items: "items-1",
  catalog_categories: "categories-1",
  price_lists: "prices-1",
  promotions: "promotions-1",
  modifier_groups: "modifier-groups-1",
  catalog_item_modifier_groups: "modifier-links-1",
  modifier_group_items: "modifier-items-1",
  inventory_levels: "inventory-1",
  locations: "locations-1",
}

const counts: Record<string, number> = {
  catalog_items: 10,
  catalog_categories: 2,
  price_lists: 1,
  promotions: 3,
  modifier_groups: 4,
  catalog_item_modifier_groups: 5,
  modifier_group_items: 6,
  inventory_levels: 2,
  locations: 1,
}

let stockRows: Record<string, unknown>[]
let locationRows: Record<string, unknown>[]
let commerce: Record<string, unknown> | null
let failTable: string | null
let failCount: boolean

function createSupabaseMock() {
  return {
    from: jest.fn((table: string) => ({
      select: (
        column: string,
        options?: { count?: string; head?: boolean },
      ) => {
        return {
          eq: jest.fn((key, siteId) => {
            expect([key, siteId]).toEqual(["site_id", "site-1"])
            const error = table === failTable ? { message: "private query detail" } : null
            if (options?.head) return Promise.resolve({ count: failCount ? null : counts[table], error })
            return {
              maybeSingle: jest.fn(async () => ({ data: { commerce }, error })),
              order: jest.fn(() => ({
                limit: jest.fn(async () => ({ data: [{ [column]: timestamps[table] }], error })),
                range: jest.fn(async (start, end) => ({
                  data: (table === "inventory_levels" ? stockRows : locationRows).slice(start, end + 1), error,
                })),
              })),
            }
          }),
        }
      },
    })),
  }
}

describe("getPosCatalogRevision", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    timestamps.modifier_groups = "modifier-groups-1"
    timestamps.inventory_levels = "inventory-1"
    timestamps.locations = "locations-1"
    counts.inventory_levels = 2
    counts.locations = 1
    stockRows = [{ id: "stock-1", quantity: 2 }, { id: "stock-2", quantity: 5 }]
    locationRows = [{ id: "location-1", is_default: true, is_active: true }]
    commerce = { stock_shortage_policy: "allow" }
    failTable = null
    failCount = false
    hashRedisKeyPartMock.mockResolvedValue("site-hash")
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => ({
      status: "computed",
      value: await compute(),
    }))
    requirePosSiteAccessMock.mockResolvedValue({ supabase: createSupabaseMock(), user: { id: "user-1" }, role: "owner" })
  })

  it("includes modifier groups, links, and items in the revision", async () => {
    const supabase = createSupabaseMock()
    requirePosSiteAccessMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      role: "owner",
    })

    const result = await getPosCatalogRevision("site-1")

    expect("data" in result && result.data.split("|").slice(0, 9)).toEqual([
        "items-1:10",
        "categories-1:2",
        "prices-1:1",
        "promotions-1:3",
        "modifier-groups-1:4",
        "modifier-links-1:5",
        "modifier-items-1:6",
        "inventory-1:2",
        "locations-1:1",
      ])
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(expect.objectContaining({ key: "cache:v2:pos-catalog-revision:site-hash" }))
    expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(
      expect.arrayContaining([
        "modifier_groups",
        "catalog_item_modifier_groups",
        "modifier_group_items",
      ]),
    )
  })

  it("changes when a modifier group is edited", async () => {
    const supabase = createSupabaseMock()
    requirePosSiteAccessMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      role: "owner",
    })

    const before = await getPosCatalogRevision("site-1")
    timestamps.modifier_groups = "modifier-groups-2"
    const after = await getPosCatalogRevision("site-1")

    expect(after).not.toEqual(before)
  })

  it.each([
    ["stock quantity without a timestamp update", () => { stockRows[0].quantity = 3 }],
    ["stock update timestamp", () => { timestamps.inventory_levels = "inventory-2" }],
    ["stock deletion", () => { stockRows.pop(); counts.inventory_levels -= 1 }],
    ["stock deletion and replacement with unchanged count", () => { stockRows[0] = { id: "replacement", quantity: 2 } }],
    ["policy", () => { commerce = { stock_shortage_policy: "block" } }],
    ["default location", () => { locationRows[0].is_default = false }],
    ["active location", () => { locationRows[0].is_active = false }],
    ["location timestamp", () => { timestamps.locations = "locations-2" }],
    ["location deletion", () => { locationRows = []; counts.locations = 0 }],
  ])("changes when %s changes", async (_label, mutate) => {
    const before = await getPosCatalogRevision("site-1")
    expect(before).toHaveProperty("data")
    ;(mutate as () => void)()
    const after = await getPosCatalogRevision("site-1")
    expect(after).toHaveProperty("data")
    expect(after).not.toEqual(before)
  })

  it("includes stock changes beyond the first 1000 rows", async () => {
    stockRows = Array.from({ length: 1001 }, (_, id) => ({ id: `stock-${id}`, quantity: 1 }))
    const before = await getPosCatalogRevision("site-1")
    stockRows[1000].quantity = 2
    expect(await getPosCatalogRevision("site-1")).not.toEqual(before)
  })

  it.each(["inventory_levels", "settings", "locations", "catalog_items"])("does not cache a fabricated revision on %s query errors", async (table) => {
    failTable = table
    expect(await getPosCatalogRevision("site-1")).toEqual({ error: "Failed to fetch catalog revision" })
  })

  it("rejects a missing exact count", async () => {
    failCount = true
    expect(await getPosCatalogRevision("site-1")).toEqual({ error: "Failed to fetch catalog revision" })
  })

  it("authorizes before cache reads", async () => {
    requirePosSiteAccessMock.mockResolvedValue({ error: "Forbidden" })
    expect(await getPosCatalogRevision("site-1")).toEqual({ error: "Forbidden" })
    expect(readThroughJsonCacheMock).not.toHaveBeenCalled()
  })

  it("reports cache lock contention without an empty revision", async () => {
    readThroughJsonCacheMock.mockResolvedValue({ status: "busy" })
    expect(await getPosCatalogRevision("site-1")).toEqual({ error: "Catalog revision is being refreshed" })
  })
})
