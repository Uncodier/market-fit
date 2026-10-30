/** @jest-environment node */
import { createDemoMockClientImpl } from "@/lib/demo-data/mock-client-impl"
import { createClient } from "@/lib/supabase/server"
import { getLeadCommerce } from "@/app/leads/commerce-actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ getCurrentUserSiteRole: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/demo-data/index", () => ({ getDemoData: async () => ({
  leads: [{ id: "demo-lead", site_id: "demo-commerce-test" }],
  quotations: [{ id: "demo-quote", site_id: "demo-commerce-test", lead_id: "demo-lead", total: 50, currency: "USD", status: "sent", created_at: "2026-10-01" }],
  sales: [
    { id: "demo-invoice", site_id: "demo-commerce-test", lead_id: "demo-lead", amount_due: 25, currency: "USD", payments: [{ id: "p1", date: "2026-10-01", amount: 25, method: "cash" }] },
    { id: "other-invoice", site_id: "demo-commerce-test", lead_id: "other-lead", amount_due: 10, payments: [] },
  ],
  sale_orders: [
    { id: "demo-order", site_id: "demo-commerce-test", sale_id: "demo-invoice", order_number: "SO-DEMO", total: 50, currency: "USD", status: "pending", created_at: "2026-10-01" },
    { id: "other-order", site_id: "demo-commerce-test", sale_id: "other-invoice", total: 10, status: "pending", created_at: "2026-10-01" },
  ],
}) }))

it("works with the existing demo query builder and never mixes other customers", async () => {
  const client = await createDemoMockClientImpl("demo-commerce-test")
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  const scope = { siteId: "demo-commerce-test", leadId: "demo-lead", page: 1 }
  const quotations = await getLeadCommerce({ ...scope, kind: "quotations" })
  expect(quotations.rows?.map(row => row.id)).toEqual(["demo-quote"])
  const purchases = await getLeadCommerce({ ...scope, kind: "purchases" })
  expect(purchases.rows?.map(row => row.id)).toEqual(["demo-order"])
  expect(purchases.rows?.[0].amountDue).toBe(25)
  const payments = await getLeadCommerce({ ...scope, kind: "payments" })
  expect(payments.rows?.map(row => row.amount)).toEqual([25])
  expect(createClient).toHaveBeenCalledWith(false)
})