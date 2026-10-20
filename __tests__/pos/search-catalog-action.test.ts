/** @jest-environment node */
import { randomUUID } from "node:crypto"
import { searchPosCatalog } from "@/app/pos/actions/search-catalog"
import { searchCatalog } from "@/lib/catalog-search/server"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"

jest.mock("@/lib/catalog-search/server", () => ({ searchCatalog: jest.fn() }))
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }))
const siteId = randomUUID(), itemId = randomUUID()
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue({ data: [{ id: itemId, site_id: siteId, name: "Match", updated_at: "now" }], error: null }) }
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ supabase: { from: jest.fn(() => query) }, user: { id: "user" }, role: "admin" } as never)
  jest.mocked(searchCatalog).mockResolvedValue({ success: true, items: [{ id: itemId, site_id: siteId }], count: 1,
    count_kind: "candidate_window", has_more: false, mode: "text", degraded: true, search_id: "search" })
})

it("authorizes site before online search and rehydrates only POS-active parent identities", async () => {
  expect((await searchPosCatalog(siteId, "tools")).items).toEqual([{ id: itemId, site_id: siteId, name: "Match", updated_at: "now" }])
  expect(requirePosSiteAccess).toHaveBeenCalledWith(siteId)
  expect(searchCatalog).toHaveBeenCalledWith(expect.objectContaining({ channel: "pos", site_id: siteId }))
  expect(query.eq.mock.calls).toEqual([["site_id", siteId], ["status", "active"]])
  expect(query.or).toHaveBeenCalledWith("is_pos_available.is.null,is_pos_available.eq.true")
  expect(query.is).toHaveBeenCalledWith("parent_id", null)
  expect(query.select).toHaveBeenCalledWith("id, site_id, name, updated_at")
})

it("rejects invalid/unauthorized tenant requests before search", async () => {
  expect(await searchPosCatalog("bad", "tools")).toHaveProperty("error")
  expect(requirePosSiteAccess).not.toHaveBeenCalled()
  jest.mocked(requirePosSiteAccess).mockResolvedValueOnce({ error: "Forbidden" })
  expect(await searchPosCatalog(siteId, "tools")).toHaveProperty("error", "Forbidden")
  expect(searchCatalog).not.toHaveBeenCalled()
})

it.each(["matched", "related", undefined] as const)("preserves %s through POS identity hydration without changing filters", async result_kind => {
  const original = await jest.mocked(searchCatalog)({ query: "tools", channel: "pos", site_id: siteId })
  jest.mocked(searchCatalog).mockResolvedValue({ ...original, result_kind,
    mode: result_kind === "related" ? "hybrid" : "text", degraded: result_kind !== "related" })
  expect(await searchPosCatalog(siteId, "tools")).toMatchObject({ result_kind: result_kind ?? "matched", count: 1 })
  expect(query.or).toHaveBeenCalledWith("is_pos_available.is.null,is_pos_available.eq.true")
  expect(query.is).toHaveBeenCalledWith("parent_id", null)
})