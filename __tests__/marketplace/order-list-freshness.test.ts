/** @jest-environment node */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/commerce/entitlements", () => ({ grantFromOrder: jest.fn() }))
jest.mock("@/app/commerce/order-fulfillment-sync", () => ({ revokeOrderFulfillment: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ readCacheEpoch: jest.fn(), bumpCacheEpoch: jest.fn(), readThroughJsonCache: jest.fn() }))
import { createClient } from "@/lib/supabase/server"
import { readThroughJsonCache } from "@/lib/redis/json-cache"
import { listOrders } from "@/app/orders/actions"

describe("provider order realtime freshness", () => {
  it("bypasses the stale server cache for a connected site's realtime reload", async () => {
    const rows = [{ id: "fresh-order", metadata: { marketplace: { state: "pending" } } }]
    const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(),
      range: jest.fn(async () => ({ data: rows, count: 1, error: null })),
      limit: jest.fn(async () => ({ data: [{ id: "connection" }], error: null })) }
    for (const method of [query.select, query.eq, query.order]) method.mockReturnValue(query)
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn(async () => ({ data: { user: { id: "actor" } } })) },
      from: jest.fn(() => query) })
    const result = await listOrders({ siteId: "site", page: 1 })
    expect(result.data).toEqual(rows.map(row => ({ ...row, leads: null })))
    expect(readThroughJsonCache).not.toHaveBeenCalled()
  })
})