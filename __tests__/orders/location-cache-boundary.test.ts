/** @jest-environment node */
import { listOrdersCached } from "@/app/orders/list-orders-cache"
import { queryOrders } from "@/app/orders/query-orders"
import { createClient } from "@/lib/supabase/server"
import { readThroughJsonCache, readCacheEpoch } from "@/lib/redis/json-cache"
import { hashRedisKeyPart } from "@/lib/redis/control-plane"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/orders/query-orders", () => ({ queryOrders: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn(async () => "key") }))
jest.mock("@/lib/redis/json-cache", () => ({ readCacheEpoch: jest.fn(), readThroughJsonCache: jest.fn() }))

const rpc = jest.fn(), getUser = jest.fn(), from = jest.fn()
let state: unknown
let role: string | null

beforeEach(() => {
  jest.clearAllMocks()
  state = false
  role = "collaborator"
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? role : state, error: null }))
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
  const query = { select: jest.fn(), eq: jest.fn(), limit: jest.fn(async () => ({ data: [], error: null })) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  from.mockReturnValue(query)
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: { getUser }, from } as never)
  jest.mocked(queryOrders).mockResolvedValue({ data: [], count: 0 })
  jest.mocked(readThroughJsonCache).mockResolvedValue({ status: "hit", value: { data: [{ id: "hidden" }], count: 1 } })
})

it("checks current permission before every warm cache hit and bypasses it after restrictions change", async () => {
  const params = { siteId: "site", locationId: "visible-location" }
  expect((await listOrdersCached(params)).data).toEqual([{ id: "hidden" }])
  state = true
  expect((await listOrdersCached(params)).data).toEqual([])
  expect(readThroughJsonCache).toHaveBeenCalledTimes(1)
  expect(queryOrders).toHaveBeenCalledWith(params)
  expect(rpc).toHaveBeenCalledTimes(4)
})

it.each([null, undefined, "false"])("does not read cached or live rows if scope is unknown: %p", async value => {
  state = value
  expect((await listOrdersCached({ siteId: "site" })).error).toBeDefined()
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
  expect(readCacheEpoch).not.toHaveBeenCalled()
})

it("does not return cached rows after site membership is removed", async () => {
  await listOrdersCached({ siteId: "site" })
  role = null
  expect((await listOrdersCached({ siteId: "site" })).error).toBe("Forbidden")
  expect(readThroughJsonCache).toHaveBeenCalledTimes(1)
})

it("denies missing authentication before any permissions or cache lookup", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await listOrdersCached({ siteId: "site" })).error).toBe("Not authenticated")
  expect(rpc).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("never lets additional action arguments impersonate another actor in the cache key", async () => {
  jest.mocked(readCacheEpoch).mockResolvedValue("7")
  const params = { siteId: "site", userId: "victim", epoch: 1 }
  await listOrdersCached(params)
  const identity = JSON.parse(jest.mocked(hashRedisKeyPart).mock.calls[0][0])
  expect(identity).toMatchObject({ userId: "actor", epoch: "7" })
})