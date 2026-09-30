/** @jest-environment node */
import { NextRequest } from "next/server"
import { GET } from "@/app/api/costs/route"
import { createClient } from "@/lib/supabase/server"
import { COST_PAGE_SIZE, MAX_COST_ROWS } from "@/app/api/costs/cost-paging"
import { costClient, costRequest, SITE, OTHER_SITE, SEGMENT, transaction, purchase } from "./cost-test-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
beforeEach(() => jest.clearAllMocks())

it.each([null, undefined, "", " ", "not-a-code", "UNSPECIFIED"])(
  "automatically reports an unknown-only currency bucket (%s) without a symbol or USD assumption", async (currency) => {
    const client = costClient({
      transactions: [transaction("t", undefined, { currency, amount: 7 })],
      purchases: [purchase("p", { currency, amount: 3 })],
    })
    jest.mocked(createClient).mockResolvedValue(client)
    const response = await GET(costRequest())
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      currency: "UNSPECIFIED", availableCurrencies: ["UNSPECIFIED"],
      totalCosts: { actual: 10, previous: 0, formattedActual: "10" },
      metadata: { currencyBasis: "unspecified-currency-bucket" },
    })
  },
)

it("returns all sorted choices on 422, including previous/monthly-only and unknown currency buckets", async () => {
  const client = costClient({
    transactions: [
      transaction("a", "2026-08-31"),
      transaction("b", "2026-07-31", { currency: "EUR" }),
      transaction("c", "2026-03-01", { currency: null }),
      transaction("d", "2026-09-01", { currency: "JPY" }),
      transaction("e", undefined, { site_id: OTHER_SITE, currency: "GBP" }),
    ],
    purchases: [purchase("a", { currency: "MXN" }), purchase("b", { currency: "CAD", status: "draft" })],
  }, { serverLimit: 1 })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({
    error: expect.stringContaining("Select a currency"), availableCurrencies: ["EUR", "MXN", "UNSPECIFIED", "USD"],
  })
  expect(client.from).not.toHaveBeenCalledWith("purchase_items")
})

it("selects the same currency for current, previous, monthly and bills before loading items", async () => {
  const client = costClient({
    transactions: [
      transaction("a", "2026-08-31", { amount: 20 }),
      transaction("b", "2026-07-31", { amount: 10 }),
      transaction("c", "2026-03-01", { amount: 4 }),
      transaction("d", "2026-08-31", { currency: "EUR", amount: 999 }),
      transaction("e", "2026-07-31", { currency: "EUR", amount: 999 }),
      transaction("f", "2026-03-01", { currency: "EUR", amount: 999 }),
    ],
    purchases: [
      purchase("a", { amount: 30 }),
      purchase("b", { amount: 15, purchase_date: "2026-07-31" }),
      purchase("c", { amount: 6, purchase_date: "2026-03-01" }),
      purchase("d", { currency: "EUR", amount: 999 }),
      purchase("e", { currency: null, amount: 999 }),
    ],
    purchase_items: [
      { id: "a", site_id: SITE, purchase_id: "a", catalog_item_id: "product", subtotal: 12, catalog_items: { kind: "product" } },
    ],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest({ currency: "USD" }))
  const data = await response.json()
  expect(response.status).toBe(200)
  expect(data).toMatchObject({
    currency: "USD", availableCurrencies: ["EUR", "UNSPECIFIED", "USD"],
    totalCosts: { actual: 50, previous: 25, percentChange: 100 },
  })
  expect(data.monthlyData).toEqual(expect.arrayContaining([
    { month: "Mar", fixedCosts: 0, variableCosts: 10 },
    { month: "Jul", fixedCosts: 0, variableCosts: 25 },
    { month: "Aug", fixedCosts: 0, variableCosts: 50 },
  ]))
  expect(data.costCategories).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Cost of goods sold", amount: 12 }),
    expect.objectContaining({ name: "Operations", amount: 18 }),
  ]))
  for (const query of client.queries.filter((q) => q.table === "purchase_items")) {
    expect(query.filters).toContainEqual({ op: "in", column: "purchase_id", value: ["a", "b", "c"] })
  }
})

it("explicitly selects unknown records without mixing any known currency", async () => {
  const client = costClient({
    transactions: [transaction("a", undefined, { currency: null }), transaction("b")],
    purchases: [purchase("a", { currency: "" }), purchase("b")],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest({ currency: "UNSPECIFIED" }))
  const data = await response.json()
  expect(response.status).toBe(200)
  expect(data).toMatchObject({ currency: "UNSPECIFIED", availableCurrencies: ["UNSPECIFIED", "USD"], totalCosts: { actual: 110 } })
  for (const query of client.queries.filter((q) => q.table === "purchase_items")) {
    expect(query.filters).toContainEqual({ op: "in", column: "purchase_id", value: ["a"] })
  }
})

it("returns an empty selected group and available alternatives rather than falling back", async () => {
  const client = costClient({ transactions: [transaction("a")], purchases: [purchase("a")] })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest({ currency: "EUR" }))
  const data = await response.json()
  expect(response.status).toBe(200)
  expect(data).toMatchObject({ currency: "EUR", availableCurrencies: ["USD"], noData: true, totalCosts: { actual: 0, previous: 0 } })
  expect(client.from).not.toHaveBeenCalledWith("purchase_items")
})

it("does not expose currencies outside the authorized segment scope", async () => {
  jest.mocked(createClient).mockResolvedValue(costClient({
    segments: [{ id: SEGMENT, site_id: SITE }],
    transactions: [transaction("a", undefined, { segment_id: SEGMENT }), transaction("b", undefined, { currency: "EUR" })],
    purchases: [purchase("a", { currency: "MXN" })],
  }))
  const data = await (await GET(costRequest({ segmentId: SEGMENT }))).json()
  expect(data).toMatchObject({ currency: "USD", availableCurrencies: ["USD"], totalCosts: { actual: 10 } })
})

it("discovers later-page currencies while aggregating only the selected group", async () => {
  const rows = Array.from({ length: COST_PAGE_SIZE + 2 }, (_, i) => transaction(String(i).padStart(5, "0")))
  rows.push(transaction("99999", undefined, { currency: "EUR", amount: 500 }))
  const client = costClient({ transactions: rows }, { serverLimit: 100 })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest({ currency: "EUR" }))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ currency: "EUR", availableCurrencies: ["EUR", "USD"], totalCosts: { actual: 500 } })
  expect(client.queries.filter((q) => q.table === "transactions")).toHaveLength(7)
})

it("keeps the union scan cap even with an explicit currency selection", async () => {
  const rows = Array.from({ length: MAX_COST_ROWS + 1 }, (_, i) => transaction(String(i).padStart(5, "0")))
  jest.mocked(createClient).mockResolvedValue(costClient({ transactions: rows }))
  const response = await GET(costRequest({ currency: "EUR" }))
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: expect.stringContaining("too large") })
})

it.each(["usd", "unspecified", "", " USD", "US", "USDD", "US1", "USD,EUR", "USD)or(id.eq.x)"])(
  "rejects malformed currency selection %s before authentication/querying", async (currency) => {
    expect((await GET(costRequest({ currency }))).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  },
)

it("rejects duplicate currency params before authentication/querying", async () => {
  const request = new NextRequest(`${costRequest({ currency: "USD" }).url}&currency=EUR`)
  expect((await GET(request)).status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})