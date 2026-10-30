/** @jest-environment node */
import { NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { GET } from "@/app/api/procurement/commerce/quotes/[id]/route"
import type { ProcurementQuotation } from "@/app/purchases/procurement/commerce/contracts"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const supplierId = "00000000-0000-4000-8000-000000000003"
const otherId = "00000000-0000-4000-8000-000000000004"
const quotation: ProcurementQuotation = {
  id, title: "External 123", reference: "External 123", supplier_id: supplierId,
  supplier_name: "Supplier", tender_id: otherId, tender_title: "Equipment tender",
  publication_id: otherId, procurement_revision: 1, currency: "USD", net_amount_minor: 2400,
  tax_amount_minor: null, recorded_at: "2026-10-28T00:00:00Z", source: "supplier_submitted", award_id: null,
  lines: [{ id: otherId, name: "Equipment", quantity: 2, unit_net_minor: 1200,
    net_amount_minor: 2400, tax_amount_minor: null, catalog_item_id: null }],
}
const contact = { name: "Purchasing contact", email: "contact@example.com", phone: "", role: "Sales", is_primary: true }
const supplier = { id: supplierId, name: "Supplier", status: "approved", commercial_terms: "Net 30", supplier_contacts: [contact] }
const request = (query = `site_id=${site}`, cookie = "session=test") => new Request(
  `http://localhost/api/procurement/commerce/quotes/${id}?${query}`, { headers: { cookie } },
)
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })
let rpc: jest.Mock
let from: jest.Mock
let select: jest.Mock
let eq: jest.Mock
let maybeSingle: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockImplementation(async (name: string) => ({
    data: name === "get_procurement_quotation" ? quotation : true, error: null,
  }))
  maybeSingle = jest.fn().mockResolvedValue({ data: supplier, error: null })
  eq = jest.fn().mockReturnThis()
  select = jest.fn().mockReturnThis()
  from = jest.fn().mockReturnValue({ select, eq, maybeSingle })
  access.mockResolvedValue({ role: "owner", userId: otherId, userEmail: null, supabase: { rpc, from } } as never)
})

it.each([401, 403])("preserves authentication/site authorization denial %s without reading", async status => {
  access.mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  const response = await GET(request(undefined, status === 401 ? "" : "session=test"), context())
  expect(response.status).toBe(status)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(rpc).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it("validates quotation UUID and a single workspace UUID before database access", async () => {
  expect((await GET(request(), context("not-a-uuid"))).status).toBe(400)
  for (const query of ["", "site_id=invalid", `site_id=${site}&site_id=${otherId}`]) {
    expect((await GET(request(query), context())).status).toBe(400)
  }
  expect(access).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it("denies demo requests without executing the live RPC", async () => {
  expect((await GET(request(undefined, `market_fit_demo_site_id=${site}`), context())).status).toBe(403)
  expect(access).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it.each(["absent", "cross-tenant", "sealed"])(
  "returns indistinguishable 404 for %s quotations excluded by the authorized RPC", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    const response = await GET(request(), context())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Quotation not found" })
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("get_procurement_quotation", { p_site: site, p_quotation: id })
    expect(from).not.toHaveBeenCalled()
  },
)

it("returns the authorized quotation and only the safe supplier projection with private caching", async () => {
  maybeSingle.mockResolvedValue({ data: { ...supplier, private_notes: "SECRET", created_by: otherId,
    supplier_contacts: [{ ...contact, user_id: otherId }] }, error: null })
  const response = await GET(request(), context())
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(await response.json()).toEqual({ data: { quotation, supplier: {
    id: supplierId, name: "Supplier", status: "approved", commercial_terms: "Net 30", contacts: [contact],
  } } })
  expect(access).toHaveBeenCalledWith(expect.any(Request), site, { requireManager: true })
  expect(rpc).toHaveBeenNthCalledWith(1, "get_procurement_quotation", { p_site: site, p_quotation: id })
  expect(rpc).toHaveBeenNthCalledWith(2, "user_can", { p_site_id: site, p_command: "select" })
  expect(from).toHaveBeenCalledTimes(1)
  expect(from).toHaveBeenCalledWith("suppliers")
  expect(select).toHaveBeenCalledWith("id,name,status,commercial_terms,supplier_contacts(name,email,phone,role,is_primary)")
  expect(eq.mock.calls).toEqual([["site_id", site], ["id", supplierId]])
})

it("accepts uppercase UUIDs and compares the normalized ID", async () => {
  const mixedId = "ABCDEFAB-0000-4000-8000-000000000002"
  rpc.mockResolvedValueOnce({ data: { ...quotation, id: mixedId.toLowerCase() }, error: null })
  expect((await GET(request(), context(mixedId))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith("get_procurement_quotation", { p_site: site, p_quotation: mixedId.toLowerCase() })
})

it("returns a null supplier when SELECT permission is denied without querying supplier data", async () => {
  rpc.mockResolvedValueOnce({ data: quotation, error: null }).mockResolvedValueOnce({ data: false, error: null })
  const response = await GET(request(), context())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ data: { quotation, supplier: null } })
  expect(from).not.toHaveBeenCalled()
})

it("returns a null supplier when scoped supplier RLS yields no row", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null })
  const response = await GET(request(), context())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ data: { quotation, supplier: null } })
})

it.each([["42501", 403], ["XX000", 503]])("sanitizes RPC failure %s", async (code, status) => {
  rpc.mockResolvedValueOnce({ data: null, error: { code, message: "SECRET" } })
  const response = await GET(request(), context())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain("SECRET")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(from).not.toHaveBeenCalled()
})

it.each(["permission", "supplier", "exception", "invalid RPC response"])("fails safely on %s errors", async failure => {
  if (failure === "permission") rpc.mockResolvedValueOnce({ data: quotation, error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "SECRET" } })
  if (failure === "supplier") maybeSingle.mockResolvedValue({ data: null, error: { message: "SECRET" } })
  if (failure === "exception") access.mockRejectedValueOnce(new Error("SECRET"))
  if (failure === "invalid RPC response") rpc.mockResolvedValueOnce({ data: [quotation], error: null })
  const response = await GET(request(), context())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("SECRET")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
})

it("loads an older quotation through the single-target RPC without requesting a list", async () => {
  const olderQuotation = { ...quotation, recorded_at: "2020-01-01T00:00:00Z" }
  rpc.mockResolvedValueOnce({ data: olderQuotation, error: null })
  const response = await GET(request(), context())
  expect(response.status).toBe(200)
  expect((await response.json()).data.quotation).toEqual(olderQuotation)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_procurement_quotation", "user_can"])
})

it("fails closed when the detail migration is missing, without a list or raw-table fallback", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "SECRET missing function" } })
  const response = await GET(request(), context())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("SECRET")
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(from).not.toHaveBeenCalled()
})

it("rejects a mismatched quotation result before reading supplier data", async () => {
  rpc.mockResolvedValueOnce({ data: { ...quotation, id: otherId }, error: null })
  expect((await GET(request(), context())).status).toBe(503)
  expect(from).not.toHaveBeenCalled()
})