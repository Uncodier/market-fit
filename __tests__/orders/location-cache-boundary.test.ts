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

it("rechecks a transient role lookup failure before reading cached orders", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST002" }, status: 503 })
  expect((await listOrdersCached({ siteId: "site" })).error).toBeUndefined()
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(rpc).toHaveBeenNthCalledWith(2, "current_user_site_role", { p_site_id: "site" })
  expect(readThroughJsonCache).toHaveBeenCalledTimes(1)
})

it("recovers from a network exception during the role lookup", async () => {
  rpc.mockRejectedValueOnce(new TypeError("fetch failed"))
  expect((await listOrdersCached({ siteId: "site" })).error).toBeUndefined()
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(readThroughJsonCache).toHaveBeenCalledTimes(1)
})

it("still bypasses cached orders for restricted members after lookup recovery", async () => {
  state = true
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST002" }, status: 503 })
  expect((await listOrdersCached({ siteId: "site" })).data).toEqual([])
  expect(queryOrders).toHaveBeenCalledWith({ siteId: "site" })
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("reports persistent lookup failures without treating them as missing membership", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST002" }, status: 503 })
  const result = await listOrdersCached({ siteId: "site" })
  expect(result.error).toBe("Order access could not be verified. Please try again.")
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
  expect(readCacheEpoch).not.toHaveBeenCalled()
})

it("does not retry a confirmed missing membership", async () => {
  role = null
  expect((await listOrdersCached({ siteId: "foreign-site" })).error).toBe("Forbidden")
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("still denies membership removed after a transient lookup failure", async () => {
  role = null
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST003" }, status: 504 })
  expect((await listOrdersCached({ siteId: "foreign-site" })).error).toBe("Forbidden")
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(from).not.toHaveBeenCalled()
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it.each([undefined, false, { role: "owner" }])("fails closed on an invalid role response: %p", async value => {
  rpc.mockResolvedValue({ data: value, error: null })
  expect((await listOrdersCached({ siteId: "site" })).error).toBe("Order access could not be verified. Please try again.")
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(from).not.toHaveBeenCalled()
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("does not retry non-transient role lookup errors or expose provider details", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private database detail" }, status: 403 })
  const result = await listOrdersCached({ siteId: "site" })
  expect(result.error).toBe("Order access could not be verified. Please try again.")
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(queryOrders).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("never lets additional action arguments impersonate another actor in the cache key", async () => {
  jest.mocked(readCacheEpoch).mockResolvedValue("7")
  const params = { siteId: "site", userId: "victim", epoch: 1 }
  await listOrdersCached(params)
  const identity = JSON.parse(jest.mocked(hashRedisKeyPart).mock.calls[0][0])
  expect(identity).toMatchObject({ userId: "actor", epoch: "7" })
})