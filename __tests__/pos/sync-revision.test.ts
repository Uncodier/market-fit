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
}

const counts: Record<string, number> = {
  catalog_items: 10,
  catalog_categories: 2,
  price_lists: 1,
  promotions: 3,
  modifier_groups: 4,
  catalog_item_modifier_groups: 5,
  modifier_group_items: 6,
}

function createSupabaseMock() {
  return {
    from: jest.fn((table: string) => ({
      select: (
        column: string,
        options?: { count?: string; head?: boolean },
      ) => {
        if (options?.head) {
          return {
            eq: jest.fn().mockResolvedValue({ count: counts[table] }),
          }
        }

        return {
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({
                data: [{ [column]: timestamps[table] }],
              }),
            })),
          })),
        }
      },
    })),
  }
}

describe("getPosCatalogRevision", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    timestamps.modifier_groups = "modifier-groups-1"
    hashRedisKeyPartMock.mockResolvedValue("site-hash")
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => ({
      status: "computed",
      value: await compute(),
    }))
  })

  it("includes modifier groups, links, and items in the revision", async () => {
    const supabase = createSupabaseMock()
    requirePosSiteAccessMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      role: "owner",
    })

    const result = await getPosCatalogRevision("site-1")

    expect(result).toEqual({
      data: [
        "items-1:10",
        "categories-1:2",
        "prices-1:1",
        "promotions-1:3",
        "modifier-groups-1:4",
        "modifier-links-1:5",
        "modifier-items-1:6",
      ].join("|"),
    })
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
})
