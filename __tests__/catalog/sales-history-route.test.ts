/** @jest-environment node */
import { NextResponse } from "next/server"
import { GET } from "@/app/api/catalog/[id]/sales/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { requireSalesReportVisibility, SalesReportVisibilityError } from "@/app/api/revenue/report-visibility"
import { loadCatalogSalesHistory } from "@/app/catalog/load-sales-history"
import { SalesReportLimitError } from "@/app/api/sales/sales-query"
import { salesTestClient } from "@/__tests__/app/api/revenue/sales-test-client"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/app/catalog/load-sales-history", () => ({ loadCatalogSalesHistory: jest.fn() }))
jest.mock("@/app/api/revenue/report-visibility", () => {
  const actual = jest.requireActual("@/app/api/revenue/report-visibility")
  return { ...actual, requireSalesReportVisibility: jest.fn() }
})
const siteId = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const client = salesTestClient({ catalog_items: [{ id, site_id: siteId }] })
const call = (params = {}, itemId = id) => GET(new Request(`http://localhost/api/catalog/${itemId}/sales?${new URLSearchParams({
  siteId, startDate: "2026-11-01", endDate: "2026-11-30", ...params,
})}`), { params: Promise.resolve({ id: itemId }) })

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue({ supabase: client, role: "owner", userId: "user", userEmail: null } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  jest.mocked(requireSalesReportVisibility).mockResolvedValue(undefined)
  jest.mocked(loadCatalogSalesHistory).mockResolvedValue({ rows: [], availableCurrencies: [] })
})

it("checks membership, select permission, full visibility and resource scope before returning private data", async () => {
  const response = await call()
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(userCanOnSite).toHaveBeenCalledWith(client, siteId, "select")
  expect(requireSalesReportVisibility).toHaveBeenCalledWith(client, siteId, "user")
  expect(loadCatalogSalesHistory).toHaveBeenCalledWith(client, siteId, id, "2026-11-01", "2026-11-30")
  expect(client.calls).toContainEqual({ table: "catalog_items", method: "eq", args: ["site_id", siteId] })
})

it.each([401, 403])("preserves authentication/access denial (%s) without reading history", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await call()).status).toBe(status)
  expect(loadCatalogSalesHistory).not.toHaveBeenCalled()
})

it("rejects missing select permission", async () => {
  jest.mocked(userCanOnSite).mockResolvedValue(false)
  expect((await call()).status).toBe(403)
  expect(loadCatalogSalesHistory).not.toHaveBeenCalled()
})

it("rejects incomplete assigned-only visibility", async () => {
  jest.mocked(requireSalesReportVisibility).mockRejectedValue(new SalesReportVisibilityError())
  expect((await call()).status).toBe(403)
  expect(loadCatalogSalesHistory).not.toHaveBeenCalled()
})

it("does not return an item from another tenant", async () => {
  expect((await call({ siteId: "00000000-0000-4000-8000-000000000003" })).status).toBe(404)
  expect(loadCatalogSalesHistory).not.toHaveBeenCalled()
})

it.each([{ startDate: "2026-02-30" }, { endDate: "2026-10-31" }, { startDate: "2024-01-01" }, { siteId: "invalid" }])(
  "validates dates and tenant identifiers (%j)", async params => {
    expect((await call(params)).status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  },
)

it("validates item identifier", async () => {
  expect((await call({}, "invalid")).status).toBe(400)
})

it("returns explicit scan limit failure", async () => {
  jest.mocked(loadCatalogSalesHistory).mockRejectedValue(new SalesReportLimitError("Too much history"))
  expect((await call()).status).toBe(422)
})

it("sanitizes database failures rather than returning a successful empty history", async () => {
  jest.mocked(loadCatalogSalesHistory).mockRejectedValue(new Error("private details"))
  const response = await call()
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Failed to load item sales. Please try again." })
})