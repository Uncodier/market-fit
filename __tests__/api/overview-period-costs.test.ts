/** @jest-environment node */

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { GET } from "@/app/api/dashboard/overview/revenue"
import { GET as originalRevenue } from "@/app/api/revenue/route"
import {
  buildOverviewPeriodCosts, loadOverviewPeriodCosts,
  type OverviewCostPurchase, type OverviewCostTransaction,
} from "@/app/api/dashboard/overview/period-costs"
import { COST_PAGE_SIZE, MAX_COST_QUERIES, MAX_COST_ROWS } from "@/app/api/costs/cost-paging"
import { salesReportPeriod } from "@/lib/sales/report-period"
import { createClient } from "@/lib/supabase/server"
import { costClient, costRequest, SITE, OTHER_SITE, SEGMENT, CAMPAIGN, purchase, transaction } from "@/__tests__/app/api/costs/cost-test-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/api/revenue/route", () => ({ GET: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  hashRedisKeyPart: jest.fn(async (value: string) => value),
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
}))

const period = salesReportPeriod(new URLSearchParams({ startDate: "2026-08-01", endDate: "2026-08-31" }))
const expense = (extra: Partial<OverviewCostTransaction> = {}): OverviewCostTransaction => ({
  date: "2026-08-01", amount: 10, type: "expense", currency: "USD", ...extra,
})
const bill = (extra: Partial<OverviewCostPurchase> = {}): OverviewCostPurchase => ({
  purchase_date: "2026-08-01", amount: 100, status: "pending", currency: "USD", ...extra,
})
const load = (client: ReturnType<typeof costClient>, segmentId = "all", currency = "USD") =>
  loadOverviewPeriodCosts(client as unknown as SupabaseClient, SITE, segmentId, period, currency)

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.ANALYTICS_MAX_RANGE_DAYS
  delete process.env.REDIS_REQUIRED
  jest.mocked(originalRevenue).mockImplementation(async () => NextResponse.json({ currency: "USD", totalSales: { actual: 1 } }))
})

describe("pure current-period builder", () => {
  it("keeps daily costs separate, sparse, sorted, and inclusive of both boundary dates", () => {
    const data = buildOverviewPeriodCosts([
      expense({ date: "2026-07-31", amount: 999 }),
      expense({ date: "2026-08-31T23:59:59.999Z", amount: "2.50" }),
      expense({ amount: 4 }), expense({ amount: 6 }),
      expense({ date: "2026-09-01", amount: 999 }), expense({ date: "2026-08-02", amount: 0 }),
    ], [bill({ purchase_date: "2026-08-15" }), bill({ purchase_date: "2026-09-01", amount: 999 })], period, "USD", "all")
    expect(data).toEqual({
      dailyData: [
        { date: "2026-08-01", expenses: 10, purchases: 0 },
        { date: "2026-08-15", expenses: 0, purchases: 100 },
        { date: "2026-08-31", expenses: 2.5, purchases: 0 },
      ],
      coverage: { startDate: "2026-08-01", endDate: "2026-08-31", complete: true },
      expensesScope: "site", purchasesScope: "site", currency: "USD",
    })
  })

  it("includes expense/fixed/variable/null legacy types but excludes income and order-linked discounts", () => {
    const types = ["expense", "expenses", "fixed", "variable", null, undefined]
    const data = buildOverviewPeriodCosts([
      ...types.map(type => expense({ type })),
      expense({ type: "income", amount: "bad" }), expense({ type: "unknown", amount: "bad" }),
      expense({ category: "promotions", sale_order_id: "order-id", amount: "bad" }),
      expense({ category: "promotions", sale_order_id: null }),
      expense({ category: "advertising", sale_order_id: "order-id" }),
    ], [], period, "USD", "all")
    expect(data.dailyData).toEqual([{ date: "2026-08-01", expenses: 80, purchases: 0 }])
  })

  it("includes only pending/completed full purchase amounts, not due balances or payment state", () => {
    const data = buildOverviewPeriodCosts([], [
      bill(), bill({ status: "completed", amount: "250.50" }),
      ...["draft", "cancelled", "refunded", "unknown"].map(status => bill({ status, amount: "bad" })),
    ], period, "USD", SEGMENT)
    expect(data.dailyData).toEqual([{ date: "2026-08-01", expenses: 0, purchases: 350.5 }])
    expect(data.expensesScope).toBe("segment")
    expect(data.purchasesScope).toBe("site")
  })

  it("normalizes sales currencies for both series without mixing malformed, missing or foreign currency rows", () => {
    const data = buildOverviewPeriodCosts([
      expense({ currency: " usd " }), expense({ currency: "EUR", amount: "bad" }),
      expense({ currency: null, amount: 99 }), expense({ currency: "invalid", amount: 99 }),
    ], [bill({ currency: "usd" }), bill({ currency: "EUR", amount: "bad" })], period, "USD", "all")
    expect(data.dailyData).toEqual([{ date: "2026-08-01", expenses: 10, purchases: 100 }])
    expect(buildOverviewPeriodCosts([expense({ currency: null })], [bill({ currency: "invalid" })],
      period, "UNSPECIFIED", "all").dailyData).toEqual([{ date: "2026-08-01", expenses: 10, purchases: 100 }])
  })

  it.each([null, "", " ", "12abc", "$12", "1,200", "NaN", Infinity, NaN])(
    "fails closed on relevant malformed expense or purchase amount %s", amount => {
      expect(() => buildOverviewPeriodCosts([expense({ amount })], [], period, "USD", "all")).toThrow("amount")
      expect(() => buildOverviewPeriodCosts([], [bill({ amount })], period, "USD", "all")).toThrow("amount")
    },
  )

  it("retains signed corrections but removes cancelled-out zero aggregates", () => {
    expect(buildOverviewPeriodCosts([expense(), expense({ amount: -10 })], [], period, "USD", "all").dailyData).toEqual([])
    expect(buildOverviewPeriodCosts([expense({ amount: -2 })], [], period, "USD", "all").dailyData[0].expenses).toBe(-2)
  })

  it("accumulates integer cents without floating-point drift in either series", () => {
    expect(buildOverviewPeriodCosts([expense({ amount: 0.1 }), expense({ amount: 0.2 })],
      [bill({ amount: "0.10" }), bill({ amount: "0.20" })], period, "USD", "all").dailyData)
      .toEqual([{ date: "2026-08-01", expenses: 0.3, purchases: 0.3 }])
  })

  it("rejects unsafe amounts and totals rather than silently losing monetary precision", () => {
    expect(() => buildOverviewPeriodCosts([expense({ amount: Number.MAX_SAFE_INTEGER })], [],
      period, "USD", "all")).toThrow("amount")
    const amount = Number.MAX_SAFE_INTEGER / 200
    expect(() => buildOverviewPeriodCosts([expense({ amount }), expense({ amount }), expense({ amount })], [],
      period, "USD", "all")).toThrow("total")
  })

  it("returns empty complete coverage after complete empty scans", () => {
    const data = buildOverviewPeriodCosts([], [], period, "USD", "all")
    expect(data.dailyData).toEqual([])
    expect(data.coverage.complete).toBe(true)
  })
})

describe("bounded RLS data loading", () => {
  it("queries only current source dates with explicit tenant bounds, never prior dates, items, or ledger", async () => {
    const client = costClient({ transactions: [
      transaction("a", "2026-07-31"), transaction("b", "2026-08-01"),
      transaction("c", "2026-08-31"), transaction("d", "2026-09-01"),
      transaction("e", "2026-08-01", { site_id: OTHER_SITE }),
    ], purchases: [purchase("p"), purchase("q", { purchase_date: "2026-07-31" })] })
    const data = await load(client)
    expect(data.dailyData).toEqual([
      { date: "2026-08-01", expenses: 10, purchases: 0 },
      { date: "2026-08-31", expenses: 10, purchases: 100 },
    ])
    expect(new Set(client.queries.map(q => q.table))).toEqual(new Set(["transactions", "purchases"]))
    for (const query of client.queries) {
      const column = query.table === "transactions" ? "date" : "purchase_date"
      expect(query.filters).toEqual(expect.arrayContaining([
        { op: "eq", column: "site_id", value: SITE },
        { op: "gte", column, value: period.start }, { op: "lt", column, value: period.endExclusive },
      ]))
      expect(query.order).toBe("id")
      expect(query.columns).not.toContain("*")
      expect(query.columns).not.toMatch(/created_at|amount_due|payments|accounting_state|ledger/)
      if (query.table === "purchases") expect(query.filters).toContainEqual({
        op: "in", column: "status", value: ["pending", "completed"],
      })
      else expect(query.columns).not.toContain("status") // Transactions have no lifecycle status column.
    }
  })

  it("pages both series to an empty completion probe even below the requested page size", async () => {
    const client = costClient({
      transactions: Array.from({ length: COST_PAGE_SIZE + 3 }, (_, i) => transaction(String(i).padStart(5, "0"))),
      purchases: [purchase("a"), purchase("b")],
    }, { serverLimit: 100 })
    const data = await load(client)
    expect(data.dailyData).toEqual([{ date: "2026-08-31", expenses: 5030, purchases: 200 }])
    const pages = client.queries.filter(q => q.table === "transactions")
    expect(pages).toHaveLength(7)
    expect(pages[1].filters).toContainEqual({ op: "gt", column: "id", value: "00099" })
    expect(pages[6].filters).toContainEqual({ op: "gt", column: "id", value: "00502" })
    expect(pages.every(q => q.limit <= COST_PAGE_SIZE)).toBe(true)
    expect(client.queries.filter(q => q.table === "purchases")).toHaveLength(2)
  })

  it("attributes expenses directly or through same-site campaigns while retaining site-wide purchases", async () => {
    const client = costClient({
      segments: [{ id: SEGMENT, site_id: SITE }],
      campaign_segments: [
        { campaign_id: CAMPAIGN, segment_id: SEGMENT, "campaigns.site_id": SITE },
        { campaign_id: "foreign", segment_id: SEGMENT, "campaigns.site_id": OTHER_SITE },
      ],
      transactions: [
        transaction("a", "2026-08-31", { segment_id: SEGMENT, amount: 20 }),
        transaction("b", "2026-08-31", { campaign_id: CAMPAIGN, amount: 30 }),
        transaction("c", "2026-08-31", { campaign_id: "foreign", amount: 999 }), transaction("d"),
      ], purchases: [purchase("p", { amount: 50 })],
    }, { serverLimit: 1 })
    expect(await load(client, SEGMENT)).toMatchObject({
      dailyData: [{ date: "2026-08-31", expenses: 50, purchases: 50 }],
      expensesScope: "segment", purchasesScope: "site",
    })
    const links = client.queries.filter(q => q.table === "campaign_segments")
    expect(links).toHaveLength(2)
    expect(links[0].filters).toContainEqual({ op: "eq", column: "campaigns.site_id", value: SITE })
    expect(links[1].filters).toContainEqual({ op: "gt", column: "campaign_id", value: CAMPAIGN })
    for (const q of client.queries.filter(q => q.table === "purchases")) {
      expect(q.filters.map(f => f.column)).not.toContain("segment_id")
    }
  })

  it("rejects cross-site segments before cost or campaign reads", async () => {
    const client = costClient({ segments: [{ id: SEGMENT, site_id: OTHER_SITE }] })
    await expect(load(client, SEGMENT)).rejects.toMatchObject({ status: 403 })
    expect(client.queries.map(q => q.table)).toEqual(["segments"])
  })

  it.each(["transactions", "purchases", "segments", "campaign_segments"])("fails closed on %s read errors", async table => {
    const client = costClient({ segments: [{ id: SEGMENT, site_id: SITE }] }, {
      failure: q => q.table === table ? "error" : undefined,
    })
    await expect(load(client, SEGMENT)).rejects.toThrow()
  })

  it.each(["error", "throw", "null"] as const)("does not publish partial data after a later page %s", async failure => {
    const client = costClient({ transactions: [transaction("a"), transaction("b")] }, {
      serverLimit: 1, failure: q => q.filters.some(f => f.op === "gt") ? failure : undefined,
    })
    await expect(load(client)).rejects.toThrow()
  })

  it("rejects stalled cursors", async () => {
    const client = costClient({ transactions: [transaction("a"), transaction("a")] })
    await expect(load(client)).rejects.toThrow("complete")
  })

  it("rejects row cap overflow rather than returning incomplete coverage", async () => {
    const client = costClient({ transactions: Array.from({ length: MAX_COST_ROWS + 1 }, (_, i) =>
      transaction(String(i).padStart(5, "0"))) })
    await expect(load(client)).rejects.toThrow("too large")
  })

  it("shares the max query budget across transactions, purchases, and segment attribution", async () => {
    const client = costClient({
      segments: [{ id: SEGMENT, site_id: SITE }],
      transactions: Array.from({ length: 100 }, (_, i) => transaction(String(i).padStart(5, "0"))),
      purchases: Array.from({ length: 100 }, (_, i) => purchase(String(i).padStart(5, "0"))),
    }, { serverLimit: 1 })
    await expect(load(client, SEGMENT)).rejects.toThrow("too large")
    expect(client.queries).toHaveLength(MAX_COST_QUERIES)
    expect(client.queries.some(q => q.table === "purchases")).toBe(true)
  })
})

describe("Overview revenue enrichment authorization and errors", () => {
  it("reuses original sales authorization then enriches with the selected report currency under RLS", async () => {
    const client = costClient({
      transactions: [transaction("a", "2026-08-31", { currency: "EUR" }), transaction("b")],
      purchases: [purchase("p", { currency: " eur " })],
    })
    jest.mocked(createClient).mockResolvedValue(client)
    jest.mocked(originalRevenue).mockResolvedValue(NextResponse.json({ currency: "EUR", totalSales: { actual: 20 } }))
    const request = costRequest({ userId: "forged" })
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("private, no-store")
    expect(await response.json()).toMatchObject({
      currency: "EUR", totalSales: { actual: 20 },
      periodCosts: { currency: "EUR", dailyData: [{ date: "2026-08-31", expenses: 10, purchases: 100 }] },
    })
    expect(originalRevenue).toHaveBeenCalledWith(request)
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(jest.mocked(createClient).mock.calls.every(args => args[0] === true)).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: SITE })
  })

  it.each(["missing", "invalid", "forbidden"])("denies %s authentication/access without any cost reads", async mode => {
    const client = costClient()
    if (mode === "invalid") client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    if (mode === "forbidden") client.rpc.mockResolvedValue({ data: null, error: null })
    jest.mocked(createClient).mockResolvedValue(client)
    expect((await GET(costRequest({}, mode !== "missing"))).status).toBe(mode === "forbidden" ? 403 : 401)
    expect(originalRevenue).not.toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each([400, 401, 403, 422, 500])("preserves original revenue HTTP %i denial/failure without loading costs", async status => {
    const client = costClient()
    jest.mocked(createClient).mockResolvedValue(client)
    const original = NextResponse.json({ error: "Sales visibility or currency unavailable" }, { status })
    jest.mocked(originalRevenue).mockResolvedValue(original)
    expect(await GET(costRequest())).toBe(original)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each([{ siteId: "bad" }, { segmentId: "bad" }, { currency: "bad-value" }, { startDate: "2026-02-30" }])(
    "validates filters and period before querying: %j", async invalid => {
      expect((await GET(costRequest(invalid))).status).toBe(400)
      expect(createClient).not.toHaveBeenCalled()
      expect(originalRevenue).not.toHaveBeenCalled()
    },
  )

  it.each(["error", "throw", "null", "amount"] as const)("reports cost %s failures safely instead of returning revenue-only success", async mode => {
    const client = costClient({ transactions: [transaction("a", "2026-08-31", { amount: mode === "amount" ? "bad" : 10 })] }, {
      failure: q => q.table === "transactions" && mode !== "amount" ? mode : undefined,
    })
    jest.mocked(createClient).mockResolvedValue(client)
    const response = await GET(costRequest())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Failed to load Overview period costs. Please try again." })
    expect(response.headers.get("Cache-Control")).toContain("no-store")
  })

  it("reports cross-site segment denial", async () => {
    jest.mocked(createClient).mockResolvedValue(costClient({ segments: [{ id: SEGMENT, site_id: OTHER_SITE }] }))
    expect((await GET(costRequest({ segmentId: SEGMENT }))).status).toBe(403)
  })

  it.each([undefined, "bad", "usd", 12])("fails safely on malformed successful revenue currency %s", async currency => {
    const client = costClient()
    jest.mocked(createClient).mockResolvedValue(client)
    jest.mocked(originalRevenue).mockResolvedValue(NextResponse.json({ currency }))
    expect((await GET(costRequest())).status).toBe(500)
    expect(client.from).not.toHaveBeenCalled()
  })
})