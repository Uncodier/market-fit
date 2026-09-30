import { costEfficiency, formatCost, percentChange, type CostData } from "@/app/components/dashboard/cost-report-data"

const costs = (actual = 250, previous: number | null = 200, currency: string | undefined = "USD"): CostData => ({
  totalCosts: { actual, previous }, currency, costCategories: [], monthlyData: [], costDistribution: [],
})
const sales = (actual = 1000, previous: number | null = 400, currency: string | undefined = "USD") => ({
  totalSales: { actual, previous }, currency,
})

it("calculates compatible current and previous ratios", () => {
  expect(costEfficiency(costs(), sales())).toMatchObject({ ratio: 4, change: 100 })
})

it.each([0, -1, NaN, Infinity])("does not calculate a ratio for invalid cost denominator %s", (actual) => {
  expect(costEfficiency(costs(actual), sales()).ratio).toBeNull()
})

it("keeps genuine zero sales distinct from unavailable sales", () => {
  expect(costEfficiency(costs(), sales(0))).toMatchObject({ ratio: 0, change: -100 })
  expect(costEfficiency(costs(), undefined).ratio).toBeNull()
  expect(costEfficiency(costs(), sales(NaN)).ratio).toBeNull()
})

it.each([null, 0, -10, NaN])("leaves ratio comparison unavailable for a missing or invalid cost baseline %s", (previous) => {
  expect(costEfficiency(costs(250, previous), sales())).toMatchObject({ ratio: 4, change: null })
})

it.each([null, 0, -10, NaN])("leaves ratio comparison unavailable for a missing or invalid sales baseline %s", (previous) => {
  expect(costEfficiency(costs(), sales(1000, previous))).toMatchObject({ ratio: 4, change: null })
})

it.each([undefined, "UNSPECIFIED", "EUR"])("refuses to divide costs and sales with unknown or incompatible currency %s", (currency) => {
  expect(costEfficiency({ ...costs(), currency }, sales()).ratio).toBeNull()
  expect(costEfficiency(costs(), { ...sales(), currency }).ratio).toBeNull()
})

it("does not mix campaign-filtered costs with site-wide sales", () => {
  expect(costEfficiency(costs(), sales(), "campaign-1").ratio).toBeNull()
})

it("does not invent a zero or 100% change from an absent baseline", () => {
  expect(percentChange(100, 0)).toBeNull()
  expect(percentChange(0, undefined)).toBeNull()
  expect(percentChange(0, null)).toBeNull()
  expect(percentChange(0, 100)).toBe(-100)
})

it("does not guess currency or replace invalid amounts with zero", () => {
  expect(formatCost(250)).toBe("250")
  expect(formatCost(250, "EUR")).toBe("€250.00")
  expect(formatCost(NaN)).toBe("Unavailable")
})