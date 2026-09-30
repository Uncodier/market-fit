/** @jest-environment node */
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  createPurchase, updatePurchase, registerPurchasePayment, receivePurchaseStock,
  publishPurchase, unpublishPurchase, deletePurchase,
} from "@/app/purchases/actions"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { upsertPolizaForPurchase, removePolizaForSource } from "@/app/accounting/ensure"
import { deleteAccountingSource, hasSourceJournal } from "@/app/accounting/source-lifecycle"
import { purchaseClient, siteId, purchaseId, userId, foreignSiteId, locationId, catalogItemId } from "./security-fixtures"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/headers", () => ({ cookies: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({ upsertPolizaForPurchase: jest.fn(), removePolizaForSource: jest.fn() }))
jest.mock("@/app/accounting/source-lifecycle", () => ({ deleteAccountingSource: jest.fn(), hasSourceJournal: jest.fn() }))

const items = [{ name: "Materials", quantity: 1, unitCost: 100 }]
const createInput = { siteId, title: "Vendor bill", purchaseDate: "2026-09-01", items }
const mutations = [
  { name: "create", command: "insert", invoke: (site = siteId) => createPurchase({ ...createInput, siteId: site }) },
  { name: "header update", command: "update", invoke: (site = siteId, id = purchaseId) => updatePurchase({ siteId: site, id, notes: "Reviewed" }) },
  { name: "item update", command: "update", invoke: (site = siteId, id = purchaseId) => updatePurchase({ siteId: site, id, items }) },
  { name: "payment", command: "update", invoke: (site = siteId, id = purchaseId) => registerPurchasePayment({ siteId: site, purchaseId: id, amount: 20, method: "bank" }) },
  { name: "receive", command: "update", invoke: (site = siteId, id = purchaseId) => receivePurchaseStock(site, id, locationId) },
  { name: "publish", command: "update", invoke: (site = siteId, id = purchaseId) => publishPurchase(site, id) },
  { name: "unpublish", command: "delete", invoke: (site = siteId, id = purchaseId) => unpublishPurchase(site, id) },
  { name: "delete", command: "delete", invoke: (site = siteId, id = purchaseId) => deletePurchase(site, id) },
] as const

function setup(options?: Parameters<typeof purchaseClient>[0]) {
  const state = purchaseClient(options)
  jest.mocked(createClient).mockResolvedValue(state.client)
  jest.mocked(cookies).mockResolvedValue({ get: jest.fn() } as unknown as Awaited<ReturnType<typeof cookies>>)
  jest.mocked(upsertPolizaForPurchase).mockImplementation(async () => { state.events.push("write:accounting:publish") })
  jest.mocked(removePolizaForSource).mockImplementation(async () => { state.events.push("write:accounting:unpublish") })
  jest.mocked(deleteAccountingSource).mockImplementation(async () => { state.events.push("write:accounting:delete") })
  return state
}

function expectNoWrites(state: ReturnType<typeof setup>) {
  expect(state.writes).toEqual([])
  expect(state.events.filter(event => event.startsWith("write:"))).toEqual([])
  expect(revalidatePath).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
}

describe("purchase mutation authorization", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  describe.each(mutations)("$name", ({ invoke, command }) => {
    it.each(["missing user", "auth error", "invalid user ID"])("rejects %s despite a session", async kind => {
      const state = setup()
      state.client.auth.getUser.mockResolvedValue({
        data: { user: kind === "missing user" ? null : { id: kind === "invalid user ID" ? "demo-user" : userId } },
        error: kind === "auth error" ? { message: "Expired token" } : null,
      })
      expect((await invoke()).error).toBe("Not authenticated")
      expect(state.client.auth.getSession).not.toHaveBeenCalled()
      expect(state.client.from).not.toHaveBeenCalled()
      expect(state.client.rpc).not.toHaveBeenCalled()
      expectNoWrites(state)
    })

    it.each(["marketing", "inactive", "cross tenant"])("denies %s before side effects", async kind => {
      const state = setup({
        role: kind === "marketing" ? "marketing" : "collaborator",
        active: kind !== "inactive", memberSiteId: kind === "cross tenant" ? foreignSiteId : siteId,
      })
      expect((await invoke()).error).toBe("Not authorized for this site")
      expect(state.client.rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: command })
      expect(state.client.from).not.toHaveBeenCalled()
      expectNoWrites(state)
    })

    it.each(["cookie", "client", "site"])("rejects demo %s without mutation", async kind => {
      const state = setup()
      if (kind === "cookie") {
        jest.mocked(cookies).mockResolvedValue({ get: () => ({ value: "demo-site" }) } as unknown as Awaited<ReturnType<typeof cookies>>)
      }
      if (kind === "client") state.client._isDemo = true
      expect((await invoke(kind === "site" ? "demo-site" : siteId)).error).toBe("Demo purchases are read-only")
      expect(createClient).toHaveBeenCalledWith(true)
      expect(state.client.from).not.toHaveBeenCalled()
      expectNoWrites(state)
    })

    it("rejects an invalid site ID before resource queries", async () => {
      const state = setup()
      expect((await invoke("not-a-site")).error).toBe("Invalid site ID")
      expect(state.client.rpc).not.toHaveBeenCalled()
      expect(state.client.from).not.toHaveBeenCalled()
      expectNoWrites(state)
    })

    it.each(["owner", "admin"] as const)("allows %s only after operation authorization", async role => {
      const state = setup({ role })
      expect((await invoke()).error).toBeNull()
      const firstWrite = state.events.findIndex(event => event.startsWith("write:"))
      expect(firstWrite).toBeGreaterThan(state.events.indexOf(`can:${command}`))
      expect(state.events.indexOf(`can:${command}`)).toBeGreaterThan(state.events.indexOf("auth"))
      expect(jest.mocked(createClient).mock.calls.every(args => args[0] === true)).toBe(true)
      expect(createServiceClient).not.toHaveBeenCalled()
      expect(state.client.auth.getSession).not.toHaveBeenCalled()
    })

    it("uses collaborator update/insert permission, never delete permission", async () => {
      const state = setup({ role: "collaborator" })
      const result = await invoke()
      expect(result.error).toBe(command === "delete" ? "Not authorized for this site" : null)
      if (command === "delete") expectNoWrites(state)
      else expect(state.events.some(event => event.startsWith("write:"))).toBe(true)
    })
  })

  it.each(mutations.filter(action => action.name !== "create"))("rejects invalid purchase IDs for $name", async ({ invoke }) => {
    const state = setup()
    expect((await invoke(siteId, "not-a-purchase")).error).toBe("Invalid purchase ID")
    expect(state.client.from).not.toHaveBeenCalled()
    expectNoWrites(state)
  })

  it.each(mutations.filter(action => action.name !== "create"))("cannot use an authorized site with another site's purchase: $name", async ({ invoke }) => {
    const state = setup({ row: { site_id: foreignSiteId } })
    expect((await invoke()).error).toBeTruthy()
    expectNoWrites(state)
    expect(state.queries.every(query => query.filters.site_id === siteId)).toBe(true)
  })

  it("requires delete permission to restore intentionally unpublished accounting before changing a draft", async () => {
    const state = setup({ role: "collaborator", row: { status: "draft", accounting_state: "unpublished" } })
    expect(await publishPurchase(siteId, purchaseId)).toEqual({ error: "Not authorized for this site" })
    expectNoWrites(state)
  })

  it("uses the authenticated creator instead of a submitted user ID", async () => {
    const state = setup()
    await createPurchase({ ...createInput, userId: foreignSiteId } as typeof createInput)
    expect(state.writes[0].data).toEqual(expect.objectContaining({ user_id: userId, site_id: siteId }))
  })

  it.each(["vendorCompanyId", "locationId", "catalogItemId"])("validates %s before creating a header", async field => {
    const state = setup()
    const result = await createPurchase({
      ...createInput, ...(field === "catalogItemId" ? { items: [{ ...items[0], catalogItemId: "bad" }] } : { [field]: "bad" }),
    })
    expect(result.error).toContain("Invalid")
    expectNoWrites(state)
  })

  it("checks reference ownership in the requested site before writing", async () => {
    const state = setup()
    expect((await createPurchase({ ...createInput, locationId, items: [{ ...items[0], catalogItemId }] })).error).toBeNull()
    expect(state.queries).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "locations", filters: { id: locationId, site_id: siteId } }),
      expect.objectContaining({ table: "catalog_items", filters: { id: catalogItemId, site_id: siteId } }),
    ]))
  })

  it("looks up vendors in the global company registry without a nonexistent site column", async () => {
    const state = setup()
    expect((await createPurchase({ ...createInput, vendorCompanyId: userId })).error).toBeNull()
    expect(state.queries.find(query => query.table === "companies")).toEqual({
      table: "companies", columns: "id", filters: { id: userId },
    })
  })

  it.each(["locations", "catalog_items"])("denies references outside this site: %s", async table => {
    const state = setup({ missingReferences: [table] })
    expect((await updatePurchase({
      siteId, id: purchaseId, locationId, items: [{ ...items[0], catalogItemId }],
    })).error).toContain("not found in this site")
    expectNoWrites(state)
  })

  it("validates the receiving location ID even for an already received purchase", async () => {
    const state = setup({ row: { stock_received: true } })
    expect(await receivePurchaseStock(siteId, purchaseId, "bad-location")).toEqual({
      success: false, error: "Invalid location ID",
    })
    expectNoWrites(state)
  })

  it("fails closed on a permission RPC error before reaching the accounting RPC", async () => {
    const state = setup()
    state.client.rpc.mockResolvedValueOnce({ data: null, error: { message: "Permission lookup failed" } })
    expect((await updatePurchase({ siteId, id: purchaseId, items })).error).toBe("Not authorized for this site")
    expectNoWrites(state)
    expect(hasSourceJournal).not.toHaveBeenCalled()
  })
})