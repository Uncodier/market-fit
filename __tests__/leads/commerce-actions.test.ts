/** @jest-environment node */
import { getLeadCommerce } from "@/app/leads/commerce-actions"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ getCurrentUserSiteRole: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"
const input = { siteId, leadId, kind: "quotations" as const, page: 1 }
type Response = { data: unknown; error: unknown; count?: number }

function fixture(responses: Record<string, Response[]>, demo = false) {
  const calls: { table: string; select: string; filters: [string, unknown][]; range?: number[] }[] = []
  const client = {
    _isDemo: demo,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) },
    from: jest.fn((table: string) => {
      const call = { table, select: "", filters: [] as [string, unknown][], range: undefined as number[] | undefined }
      calls.push(call)
      const response = responses[table]?.shift() || { data: [], error: null, count: 0 }
      const query = {
        select: (value: string) => { call.select = value; return query },
        eq: (key: string, value: unknown) => { call.filters.push([key, value]); return query },
        order: () => query,
        range: (from: number, to: number) => { call.range = [from, to]; return query },
        abortSignal: () => query,
        maybeSingle: () => Promise.resolve(response),
        then: (resolve: (value: Response) => unknown) => Promise.resolve(response).then(resolve),
      }
      return query
    }),
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { client, calls }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue("collaborator")
  jest.mocked(userCanOnSite).mockResolvedValue(true)
})

it("rejects invalid IDs, kind and pagination before accessing data", async () => {
  expect(await getLeadCommerce({ ...input, leadId: "other" })).toHaveProperty("error")
  expect(await getLeadCommerce({ ...input, page: 0 })).toHaveProperty("error")
  expect(createClient).not.toHaveBeenCalled()
})

it("requires authentication, membership and select capability", async () => {
  const { client } = fixture({})
  client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect(await getLeadCommerce(input)).toEqual({ error: "Authentication required." })
  jest.mocked(getCurrentUserSiteRole).mockResolvedValueOnce(null)
  expect(await getLeadCommerce(input)).toHaveProperty("error")
  jest.mocked(userCanOnSite).mockResolvedValueOnce(false)
  expect(await getLeadCommerce(input)).toHaveProperty("error")
  expect(client.from).not.toHaveBeenCalled()
})

it("does not query commerce when the lead is outside the site", async () => {
  const { calls } = fixture({ leads: [{ data: null, error: null }] })
  expect(await getLeadCommerce(input)).toEqual({ error: "Lead not found or access denied." })
  expect(calls).toHaveLength(1)
  expect(calls[0].filters).toEqual([["site_id", siteId], ["id", leadId]])
})

it("pages only this lead's quotations without public tokens", async () => {
  const { calls } = fixture({
    leads: [{ data: { id: leadId }, error: null }],
    quotations: [{ data: [{ id: "quote-1", total: "50", currency: "EUR", status: "sent", created_at: "2026-10-01" }], count: 26, error: null }],
  })
  const result = await getLeadCommerce({ ...input, page: 2 })
  expect(result.count).toBe(26)
  expect(result.rows?.[0]).toMatchObject({ amount: 50, currency: "EUR", href: "/quotations/quote-1" })
  expect(calls[1].filters).toEqual([["site_id", siteId], ["lead_id", leadId]])
  expect(calls[1].range).toEqual([25, 49])
  expect(calls[1].select).not.toMatch(/\*|token/)
})

it("scopes purchases through the linked invoice and both site IDs", async () => {
  const { calls } = fixture({
    leads: [{ data: { id: leadId }, error: null }],
    sale_orders: [{ data: [{ id: "order-1", order_number: "SO-1", total: 100, currency: "USD", status: "pending", created_at: "2026-10-01", sales: { amount_due: 25 } }], count: 1, error: null }],
  })
  const result = await getLeadCommerce({ ...input, kind: "purchases" })
  expect(result.rows?.[0]).toMatchObject({ href: "/orders/order-1", amountDue: 25 })
  expect(calls[1].filters).toEqual([["site_id", siteId], ["sales.site_id", siteId], ["sales.lead_id", leadId]])
  expect(calls[1].select).toContain("sales!inner")
})

it("uses actual payments across invoice batches, preserves currencies and sorts receipt dates", async () => {
  const invoices = Array.from({ length: 500 }, (_, index) => ({ id: `invoice-${index}`, currency: "USD", payments: [] }))
  const { calls } = fixture({
    leads: [{ data: { id: leadId }, error: null }],
    sales: [
      { data: invoices, error: null },
      { data: [{ id: "old-invoice", invoice_number: "INV-1", currency: "USD", payments: [
        { id: "p1", date: "2026-01-01", amount: 12, method: "cash" },
        { id: "p2", date: "2026-10-29", amount: 30, currency: "EUR", method: "card" },
        { amount: "bad" },
      ] }], error: null },
    ],
  })
  const result = await getLeadCommerce({ ...input, kind: "payments" })
  expect(result.count).toBe(2)
  expect(result.rows?.map(row => [row.amount, row.currency])).toEqual([[30, "EUR"], [12, "USD"]])
  expect(result.rows?.[0].href).toBe("/sales/old-invoice")
  expect(calls[2].range).toEqual([500, 999])
  expect(calls.slice(1).every(call => call.filters.some(([key, value]) => key === "lead_id" && value === leadId))).toBe(true)
})

it("returns safe errors instead of empty successful data or raw database messages", async () => {
  fixture({ leads: [{ data: { id: leadId }, error: null }], quotations: [{ data: null, error: { message: "private SQL" } }] })
  expect(await getLeadCommerce(input)).toEqual({ error: "Unable to load quotations. Please retry." })
})

it("never permits demo credentials to read real data", async () => {
  const { client } = fixture({}, true)
  expect(await getLeadCommerce(input)).toHaveProperty("error")
  expect(client.from).not.toHaveBeenCalled()
})