/** @jest-environment node */

import { GET } from "@/app/api/sites/route"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"

jest.mock("@/lib/auth/site-member-request", () => ({
  createServiceSupabase: jest.fn(),
  createUserSupabase: jest.fn(),
}))
jest.mock("@/lib/sites/list-accessible-sites", () => ({ listAccessibleSitesForUser: jest.fn() }))

describe("GET /api/sites detail archive filtering", () => {
  beforeEach(() => jest.clearAllMocks())

  function setup(archivedAt: string | null, siteIds = ["site-1"]) {
    jest.mocked(createUserSupabase).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    } as never)
    jest.mocked(listAccessibleSitesForUser).mockResolvedValue({
      sites: siteIds.map((id) => ({ id })), error: null,
    })
    const detail = { id: "site-1", logo_url: "logo", tracking: {}, resource_urls: [] }
    let excludeArchived = false
    const detailQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockImplementation(function () {
        excludeArchived = true
        return detailQuery
      }),
      single: jest.fn(async () => ({
        data: excludeArchived && archivedAt ? null : detail,
        error: null,
      })),
    }
    const billingQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      returns: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    const admin = { from: jest.fn((table: string) => {
      if (table === "sites") return detailQuery
      return billingQuery
    }) }
    jest.mocked(createServiceSupabase).mockReturnValue(admin as never)
    return { admin, detailQuery, detail, billingQuery }
  }

  it.each([null, "2026-09-22T10:00:00Z"])("rechecks archive state on detail lookup (%s)", async (archivedAt) => {
    const { detailQuery, detail } = setup(archivedAt)
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, detail: archivedAt ? null : detail })
    expect(detailQuery.eq).toHaveBeenCalledWith("id", "site-1")
    expect(detailQuery.is).toHaveBeenCalledWith("archived_at", null)
  })

  it("does not query details for a site outside the accessible list", async () => {
    const { admin } = setup(null, ["other-site"])
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))
    expect(await response.json()).toMatchObject({ detail: null })
    expect(admin.from).not.toHaveBeenCalledWith("sites")
  })

  it("still requires authentication before using the service client", async () => {
    setup(null)
    jest.mocked(createUserSupabase).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never)
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))
    expect(response.status).toBe(401)
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })

  it("returns actual annual interval and paid coverage only for authorized sites", async () => {
    const { billingQuery } = setup(null)
    const annualRow = {
      site_id: 'site-1', plan: 'engine', billing_interval: 'year',
      addons_count: 2, credits_available: 20, auto_renew: false,
      plan_credit_anchor: '2026-01-01T00:00:00Z',
      paid_subscription_period_start: '2026-01-01T00:00:00Z',
      paid_subscription_period_end: '2027-01-01T00:00:00Z',
      paid_subscription_invoice_id: 'invoice-example',
      paid_subscription_paid_at: '2026-01-01T00:00:00Z',
      paid_subscription_plan: 'engine', paid_subscription_addons_count: 2,
    }
    // Emulate PostgREST projection so missing selected fields fail response assertions.
    billingQuery.returns.mockImplementation(async () => ({
      data: [Object.fromEntries(billingQuery.select.mock.calls[0][0].split(', ')
        .filter((field: string) => field in annualRow)
        .map((field: keyof typeof annualRow) => [field, annualRow[field]]))],
      error: null,
    }))
    const response = await GET(new Request('https://example.test/api/sites'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.sites[0].billing).toEqual(annualRow)
    expect(billingQuery.in).toHaveBeenCalledWith('site_id', ['site-1'])
    expect(billingQuery.select.mock.calls[0][0].split(', ')).not.toContain('card_number')
    expect(billingQuery.select.mock.calls[0][0].split(', ')).not.toContain('card_cvc')
  })

  it("keeps an up-to-date monthly account visible when annual columns are not deployed", async () => {
    const { billingQuery } = setup(null)
    const monthly = { site_id: 'site-1', plan: 'foundry', credits_available: 42, account_balance: 10 }
    billingQuery.returns.mockResolvedValueOnce({ data: null, error: {
      code: '42703', message: 'column billing.billing_interval does not exist',
    } } as never).mockResolvedValueOnce({ data: [monthly], error: null } as never)
    const response = await GET(new Request('https://example.test/api/sites'))
    expect(await response.json()).toMatchObject({ success: true, sites: [{ billing: monthly, billing_read_status: 'loaded' }] })
    const fields = billingQuery.select.mock.calls[1][0].split(', ')
    expect(fields).not.toContain('billing_interval')
    expect(fields).not.toContain('paid_subscription_period_end')
    expect(fields).not.toContain('card_number')
  })

  it.each(['42501', 'PGRST000', '42703'])("reports unreadable billing without claiming initialization is missing (%s)", async code => {
    const { billingQuery } = setup(null)
    billingQuery.returns.mockResolvedValue({ data: null, error: { code, message: 'Private database diagnostic' } } as never)
    const response = await GET(new Request('https://example.test/api/sites'))
    const body = await response.json()
    expect(body).toMatchObject({ success: true, sites: [{ billing_read_status: 'unavailable' }] })
    expect(body.sites[0]).not.toHaveProperty('billing')
    expect(JSON.stringify(body)).not.toContain('Private database diagnostic')
    expect(billingQuery.in).toHaveBeenCalledTimes(1)
  })

  it("marks billing as missing only after a successful empty financial read", async () => {
    setup(null)
    const response = await GET(new Request('https://example.test/api/sites'))
    expect(await response.json()).toMatchObject({ sites: [{ billing_read_status: 'missing' }] })
  })
})