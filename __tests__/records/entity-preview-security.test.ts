/** @jest-environment node */
import { resolveEntityPreviews, resolveRelationsForSidebar } from "@/app/records/entity-preview-actions"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { fetchPreviewBatches } from "@/app/records/lib/entity-preview-request"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/permissions/location-boundary", () => ({ canAccessUnscopedSite: jest.fn() }))

const site = "11111111-1111-4111-8111-111111111111"
const otherSite = "22222222-2222-4222-8222-222222222222"
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const category = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
type Row = Record<string, unknown>
let rows: Record<string, Row[]>
let calls: { table: string; operation: string; args: unknown[] }[]
let auth: jest.Mock
let from: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  rows = {}
  calls = []
  auth = jest.fn().mockResolvedValue({ data: { user: { id } }, error: null })
  from = jest.fn((table: string) => {
    let filtered = [...(rows[table] || [])]
    const query: Record<string, unknown> = {}
    for (const operation of ["select", "eq", "is", "in", "not", "order", "range", "or", "limit"]) {
      query[operation] = (...args: unknown[]) => {
        calls.push({ table, operation, args })
        const [column, value] = args as [string, unknown]
        if (operation === "eq") filtered = filtered.filter(row => row[column] === value)
        if (operation === "is") filtered = filtered.filter(row => row[column] == null)
        if (operation === "limit") filtered = filtered.slice(0, args[0] as number)
        if (operation === "in") filtered = filtered.filter(row => (value as unknown[]).includes(row[column]))
        if (operation === "or") {
          const key = column.split(".")[0]
          filtered = filtered.filter(row => row[key] == null || row[key] === false)
        }
        return query
      }
    }
    query.maybeSingle = async () => ({ data: filtered[0] || null, error: null })
    query.then = (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: filtered, error: null }))
    return query
  })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: auth }, from } as never)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true)
})

describe.each([resolveEntityPreviews, resolveRelationsForSidebar])("preview boundary %p", resolve => {
  it.each([
    [undefined, [{ target: "lead", ids: [id] }]],
    ["bad-site", [{ target: "lead", ids: [id] }]],
    [site, [{ target: "lead", ids: ["bad-id"] }]],
    [site, [{ target: "lead", ids: Array(201).fill(id) }]],
    [site, Array(51).fill({ target: "lead", ids: [id] })],
    [site, [...Array(5).fill({ target: "lead", ids: Array(200).fill(id) }), { target: "lead", ids: [id] }]],
    [site, [{ target: "record", ids: [id], targetCategoryId: "bad" }]],
    [site, [{ target: "lead", ids: [id], targetCategoryId: category }]],
  ])("rejects malformed or unbounded inputs", async (siteId, requests) => {
    expect(await resolve(requests as never, siteId as string)).toEqual({})
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(["anonymous", "permission", "location"])("denies %s before target reads", async denial => {
    if (denial === "anonymous") auth.mockResolvedValue({ data: { user: null }, error: null })
    if (denial === "permission") jest.mocked(userCanOnSite).mockResolvedValue(false)
    if (denial === "location") jest.mocked(canAccessUnscopedSite).mockResolvedValue(false)
    expect(await resolve([{ target: "lead", ids: [id] }], site)).toEqual({})
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects cross-site rows even when RLS can read both sites", async () => {
    rows.leads = [{ id, site_id: otherSite, name: "Foreign" }]
    expect(await resolve([{ target: "lead", ids: [id] }], site)).toEqual({})
    expect(userCanOnSite).toHaveBeenCalledWith(expect.anything(), site, "select")
  })

  it("never reinterprets unsupported person targets", async () => {
    expect(await resolve([{ target: "person", ids: [id] }, { target: "__proto__", ids: [id] }], site)).toEqual({})
    expect(from).not.toHaveBeenCalled()
  })
})

it("uses shared sales order and supplier targets with collision-safe keys", async () => {
  rows.sale_orders = [{ id, site_id: site, order_number: "SO-1" }]
  rows.suppliers = [{ id, site_id: site, name: "Supplier" }]
  const result = await resolveEntityPreviews([{ target: "sales_order", ids: [id] }, { target: "supplier", ids: [id] }], site)
  expect(result[`sales_order:${id}`].label).toBe("SO-1")
  expect(result[`supplier:${id}`].label).toBe("Supplier")
  expect(result[id]).toBeUndefined()
  expect(from).not.toHaveBeenCalledWith("orders")
})

it("allows companies only via same-site readable associations without companies.site_id", async () => {
  rows.companies = [{ id, name: "Company" }]
  rows.leads = [{ id, company_id: id, site_id: otherSite }]
  expect(await resolveEntityPreviews([{ target: "company", ids: [id] }], site)).toEqual({})
  rows.suppliers = [{ id, company_id: id, site_id: site }]
  const result = await resolveEntityPreviews([{ target: "company", ids: [id] }], site)
  expect(result[id].label).toBe("Company")
  expect(calls.some(call => call.table === "companies" && call.operation === "eq" && call.args[0] === "site_id")).toBe(false)
})

it("scopes team member user IDs to active, enabled membership", async () => {
  rows.site_members = [{ user_id: id, site_id: site, status: "active", name: "Member" }]
  expect((await resolveEntityPreviews([{ target: "team_member", ids: [id] }], site))[id].label).toBe("Member")
  for (const patch of [{ status: "inactive" }, { manually_disabled: true }, { license_suspended: true }, { site_id: otherSite }]) {
    rows.site_members = [{ user_id: id, site_id: site, status: "active", name: "Member", ...patch }]
    expect(await resolveEntityPreviews([{ target: "team_member", ids: [id] }], site)).toEqual({})
  }
})

it("validates and enforces internal category scope", async () => {
  rows.record_categories = [{ id: category, site_id: site }]
  rows.records = [{ id, category_id: category, site_id: site, title: "Record" }]
  const request = [{ target: "record", ids: [id], targetCategoryId: category }]
  expect((await resolveEntityPreviews(request, site))[`record:${category}:${id}`].label).toBe("Record")
  rows.records[0].category_id = id
  expect(await resolveEntityPreviews(request, site)).toEqual({})
  rows.record_categories[0].site_id = otherSite
  expect(await resolveEntityPreviews(request, site)).toEqual({})
})

it.each(["record", "record_category"])("excludes trashed %s previews and labels", async target => {
  rows[target === "record" ? "records" : "record_categories"] = [
    { id, site_id: site, title: "Trashed", name: "Trashed", deleted_at: "2026-11-11" },
  ]
  for (const resolve of [resolveEntityPreviews, resolveRelationsForSidebar]) {
    expect(await resolve([{ target, ids: [id] }], site)).toEqual({})
  }
  expect(calls).toContainEqual({ table: target === "record" ? "records" : "record_categories", operation: "is", args: ["deleted_at", null] })
})

it("rejects a trashed target category even for a readable live record", async () => {
  rows.record_categories = [{ id: category, site_id: site, deleted_at: "2026-11-11" }]
  rows.records = [{ id, site_id: site, category_id: category, title: "Live" }]
  expect(await resolveEntityPreviews([{ target: "record", ids: [id], targetCategoryId: category }], site)).toEqual({})
})

it.each([201, 1000, 1001, 2201])("resolves all %i IDs through bounded client calls", async count => {
  const ids = Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`)
  rows.records = ids.map(id => ({ id, site_id: site, category_id: category, title: id }))
  rows.record_categories = [{ id: category, site_id: site }]
  const resolve = jest.fn(resolveEntityPreviews)
  const result = await fetchPreviewBatches([{ target: "record", targetCategoryId: category, ids }], site, resolve)
  expect(ids.every(id => result[`record:${category}:${id}`]?.label === id)).toBe(true)
  expect(resolve).toHaveBeenCalledTimes(Math.ceil(count / 1000))
  for (const [batch] of resolve.mock.calls) {
    expect(batch.length).toBeLessThanOrEqual(50)
    expect(batch.every(request => request.ids.length <= 200)).toBe(true)
    expect(batch.reduce((sum, request) => sum + request.ids.length, 0)).toBeLessThanOrEqual(1000)
    expect(batch.every(request => request.targetCategoryId === category)).toBe(true)
  }
})

it("batches aggregate category requests without resolving a wrong-category ID", async () => {
  const ids = Array.from({ length: 600 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`)
  rows.records = ids.map(id => ({ id, site_id: site, category_id: category, title: id }))
  rows.record_categories = [{ id: category, site_id: site }, { id: otherSite, site_id: site }]
  const resolve = jest.fn(resolveEntityPreviews)
  const result = await fetchPreviewBatches([
    { target: "record", targetCategoryId: category, ids },
    { target: "record", targetCategoryId: otherSite, ids },
  ], site, resolve)
  expect(resolve).toHaveBeenCalledTimes(2)
  expect(Object.keys(result)).toHaveLength(600)
  for (const id of ids) {
    expect(result[`record:${category}:${id}`]?.label).toBe(id)
    expect(result[`record:${otherSite}:${id}`]).toBeUndefined()
    expect(result[id]).toBeUndefined()
  }
})