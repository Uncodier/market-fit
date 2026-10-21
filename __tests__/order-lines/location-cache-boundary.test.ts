/** @jest-environment node */
import { readCachedOrderLines } from "@/app/order-lines/list-order-lines-cache"
import { createClient } from "@/lib/supabase/server"
import { readThroughJsonCache } from "@/lib/redis/json-cache"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn(async () => "key") }))
jest.mock("@/lib/redis/json-cache", () => ({ readCacheEpoch: jest.fn(), readThroughJsonCache: jest.fn() }))

const rpc = jest.fn()
const load = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null }))
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: {
    getUser: jest.fn(async () => ({ data: { user: { id: "actor" } }, error: null })),
  } } as never)
  load.mockResolvedValue({ data: [], count: 0 })
  jest.mocked(readThroughJsonCache).mockResolvedValue({ status: "hit", value: { data: [{ id: "hidden-line" }], count: 1 } })
})

it("bypasses warm unrestricted results as soon as a site restriction is added", async () => {
  expect((await readCachedOrderLines({ siteId: "site" }, load)).count).toBe(1)
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }))
  expect((await readCachedOrderLines({ siteId: "site" }, load)).count).toBe(0)
  expect(load).toHaveBeenCalledTimes(1)
  expect(readThroughJsonCache).toHaveBeenCalledTimes(1)
})

it.each([null, "false"])("denies unverifiable state %p without consuming cache or querying lines", async state => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : state, error: null }))
  expect((await readCachedOrderLines({ siteId: "site" }, load)).error).toBeDefined()
  expect(load).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})

it("recovers a temporary membership lookup failure before consuming the cache", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST002" }, status: 503 })
  expect((await readCachedOrderLines({ siteId: "site" }, load)).count).toBe(1)
  expect(rpc).toHaveBeenCalledTimes(3)
})

it("does not label persistent lookup failures as Forbidden", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST002" }, status: 503 })
  expect((await readCachedOrderLines({ siteId: "site" }, load)).error)
    .toBe("Site access could not be verified. Please try again.")
  expect(load).not.toHaveBeenCalled()
  expect(readThroughJsonCache).not.toHaveBeenCalled()
})