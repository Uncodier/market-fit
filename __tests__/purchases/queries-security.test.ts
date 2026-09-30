/** @jest-environment node */
import { listPurchases, getPurchaseById, getPurchaseWithoutContext } from "@/app/purchases/purchase-queries"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { purchaseClient, siteId, purchaseId, userId, foreignSiteId } from "./security-fixtures"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/headers", () => ({ cookies: jest.fn() }))

const queries = [
  { name: "list", invoke: () => listPurchases({ siteId }), failure: { data: null, count: 0 } },
  { name: "detail", invoke: () => getPurchaseById(siteId, purchaseId), failure: { purchase: null } },
  { name: "without context", invoke: () => getPurchaseWithoutContext(purchaseId), failure: { purchase: null, site: null } },
]

function setup(options?: Parameters<typeof purchaseClient>[0]) {
  const state = purchaseClient(options)
  jest.mocked(createClient).mockResolvedValue(state.client)
  return state
}

describe("purchase read authorization", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  describe.each(queries)("$name", ({ invoke, failure, name }) => {
    it.each(["missing user", "auth error"])("rejects %s before any read despite a session", async kind => {
      const { client } = setup()
      client.auth.getUser.mockResolvedValue({
        data: { user: kind === "missing user" ? null : { id: userId } },
        error: kind === "auth error" ? { message: "Expired token" } : null,
      })
      expect(await invoke()).toEqual({ ...failure, error: "Not authenticated" })
      expect(client.from).not.toHaveBeenCalled()
      expect(client.rpc).not.toHaveBeenCalled()
      expect(client.auth.getSession).not.toHaveBeenCalled()
    })

    it.each(["owner", "admin", "collaborator", "marketing"] as const)("allows %s to read", async role => {
      const state = setup({ role })
      expect((await invoke()).error).toBeNull()
      expect(state.client.rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "select" })
      expect(jest.mocked(createClient).mock.calls.every(args => args[0] === true)).toBe(true)
      expect(state.client.auth.getSession).not.toHaveBeenCalled()
      expect(state.writes).toEqual([])
      expect(createServiceClient).not.toHaveBeenCalled()
    })

    it.each(["inactive", "cross tenant"])("denies %s without returning purchase data", async kind => {
      const state = setup({ active: kind !== "inactive", memberSiteId: kind === "cross tenant" ? foreignSiteId : siteId })
      expect(await invoke()).toEqual({ ...failure, error: "Not authorized for this site" })
      if (name === "without context") {
        expect(state.queries).toEqual([{ table: "purchases", columns: "site_id", filters: { id: purchaseId } }])
      } else {
        expect(state.client.from).not.toHaveBeenCalled()
      }
      expect(state.writes).toEqual([])
    })

    it("rejects a demo client as authentication for real purchase data", async () => {
      const state = setup()
      state.client._isDemo = true
      expect(await invoke()).toEqual({ ...failure, error: "Demo purchases are read-only" })
      expect(state.client.from).not.toHaveBeenCalled()
    })
  })

  it("resolves only the trusted purchase site before fetching context and scopes the second read", async () => {
    const state = setup({ memberSiteId: foreignSiteId, row: { site_id: foreignSiteId } })
    const result = await getPurchaseWithoutContext(purchaseId)
    expect(result.error).toBeNull()
    expect(state.client.rpc).toHaveBeenCalledWith("user_can", { p_site_id: foreignSiteId, p_command: "select" })
    expect(state.queries[0]).toEqual({ table: "purchases", columns: "site_id", filters: { id: purchaseId } })
    expect(state.queries[1].filters).toEqual({ id: purchaseId, site_id: foreignSiteId })
  })

  it("does not accept a valid site permission as access to a foreign purchase", async () => {
    const state = setup({ row: { site_id: foreignSiteId } })
    const result = await getPurchaseById(siteId, purchaseId)
    expect(result.purchase).toBeNull()
    expect(result.error).toBeTruthy()
    expect(state.queries[0].filters).toEqual({ id: purchaseId, site_id: siteId })
  })

  it.each([
    () => listPurchases({ siteId: "invalid" }),
    () => listPurchases({ siteId, locationId: "invalid" }),
    () => getPurchaseById("invalid", purchaseId),
    () => getPurchaseById(siteId, "invalid"),
    () => getPurchaseWithoutContext("invalid"),
  ])("validates supplied IDs before resource reads", async invoke => {
    const state = setup()
    expect((await invoke()).error).toContain("Invalid")
    expect(state.client.from).not.toHaveBeenCalled()
  })

  it("keeps the all-locations filter working", async () => {
    setup()
    expect((await listPurchases({ siteId, locationId: "all" })).error).toBeNull()
  })
})