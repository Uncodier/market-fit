import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import { salePaymentLedger } from "@/app/api/revenue/payment-ledger"
import { salesReportPeriod } from "@/lib/sales/report-period"
import type { ReportSale } from "@/app/api/sales/sales-query"
import { salesTestClient } from "./sales-test-client"

const period = salesReportPeriod(new URLSearchParams({ startDate: "2026-09-01", endDate: "2026-09-02" }))
const options = { currency: null, segmentId: "all", includeCategories: false }
const sale = (extra: Partial<ReportSale> = {}): ReportSale => ({
  id: "sale", amount: 100, amount_due: 100, payments: [], status: "pending", currency: "USD",
  sale_date: "2026-09-01", created_at: "2026-09-01T12:00:00Z", ...extra,
})
const payment = (amount: number, date = "2026-09-01", extra = {}) => ({ amount, date, ...extra })
const refund = (amount: number, date = "2026-09-02", extra = {}) => ({
  id: "re_1", sale_id: "sale", amount, refunded_at: date, currency: "USD", ...extra,
})
const report = (sales: ReportSale[]) => buildSalesReport(salesTestClient({}), sales, period, options)

it("separates active value, actual cash, current balance and payment states", async () => {
  const result = await report([
    sale({ id: "unpaid" }),
    sale({ id: "partial", amount_due: 80, payments: [payment(20)] }),
    sale({ id: "paid", amount_due: 0, payments: [payment(100)] }),
  ])
  expect(result.totalSales.actual).toBe(300)
  expect(result.transactions.actual).toBe(3)
  expect(result.financialSummary).toMatchObject({
    receipts: { actual: 120 }, refunds: { actual: 0 }, netCollected: { actual: 120 },
    outstanding: { amount: 180, saleCount: 3, unknownSaleCount: 0 },
    paymentStatus: { paid: { count: 1, amount: 100 }, partial: { count: 1, amount: 100 }, unpaid: { count: 1, amount: 100 } },
  })
})

it("excludes cancelled sales and orders from every sales aggregate without deleting their cash", async () => {
  const rows = [sale({ id: "valid", source: "shop", product_type: "Services" }),
    sale({ id: "cancelled-sale", status: "cancelled", amount_due: 0, payments: [payment(100)] }),
    sale({ id: "cancelled-order", order_statuses: ["cancelled"], amount_due: 80, payments: [payment(20)] }),
    sale({ id: "mixed-orders", order_statuses: ["completed", "cancelled"] }),
    sale({ id: "refunded", status: "refunded", amount_due: 0, payments: [payment(100)], refunds: [refund(100)] })]
  const result = await buildSalesReport(salesTestClient({}), rows, period, { ...options, includeCategories: true })
  expect(result.totalSales.actual).toBe(100)
  expect(result.transactions.actual).toBe(1)
  expect(result.averageOrderValue.actual).toBe(100)
  expect(result.monthlyData[0].totalSales).toBe(100)
  expect(result.dailyData?.reduce((sum, day) => sum + day.totalSales, 0)).toBe(100)
  expect(result.salesDistribution.reduce((sum, channel) => sum + channel.amount, 0)).toBe(100)
  expect(result.salesCategories).toEqual([{ name: "Services", amount: 100, prevAmount: 0, percentChange: null }])
  expect(result.financialSummary).toMatchObject({
    receipts: { actual: 220 }, refunds: { actual: 100 }, netCollected: { actual: 120 },
    excluded: { count: 4, amount: 400 }, outstanding: { amount: 100, saleCount: 1 },
  })
})

it("uses UTC movement dates independently of sale dates, including advances and negative net receipts", async () => {
  const result = await report([
    sale({ id: "old", sale_date: "2025-01-01", amount_due: 0,
      payments: [payment(100, "2026-08-31T23:30:00-02:00")], refunds: [refund(20)] }),
    sale({ id: "future", sale_date: "2026-10-01", amount_due: 90, payments: [payment(10)] }),
    sale({ id: "old-refund", status: "refunded", sale_date: "2025-02-01", amount_due: 0,
      payments: [payment(100, "2026-08-30")], refunds: [refund(100)] }),
  ])
  expect(result.totalSales.actual).toBe(0)
  expect(result.noData).toBe(true)
  expect(result.financialSummary).toMatchObject({
    receipts: { actual: 110, previous: 100 }, refunds: { actual: 120, previous: 0 },
    netCollected: { actual: -10, previous: 100 },
  })
  expect(result.financialSummary?.netCollected?.percentChange).toBeCloseTo(-110)
})

it("does not classify a completed but unpaid sale as paid", async () => {
  const result = await report([sale({ status: "completed" })])
  expect(result.financialSummary).toMatchObject({
    netCollected: { actual: 0 }, outstanding: { amount: 100 }, paymentStatus: { unpaid: { count: 1 } },
  })
})

it("does not count pending or failed payment attempts as receipts", async () => {
  const result = await report([sale({ payments: [payment(100, "2026-09-01", { status: "pending" }),
    payment(100, "2026-09-01", { status: "failed" })] })])
  expect(result.financialSummary).toMatchObject({ receipts: { actual: 0 }, netCollected: { actual: 0 }, outstanding: { amount: 100 } })
})

it("keeps today's balance distinct from receipt totals in a historical period", async () => {
  const result = await report([sale({ amount_due: 0, payments: [payment(100, "2026-09-10")] })])
  expect(result.financialSummary).toMatchObject({ receipts: { actual: 0 }, outstanding: { amount: 0 } })
})

it.each([
  { amount_due: 0, payments: [] },
  { amount_due: null, payments: [] },
  { amount_due: 0, payments: [{ amount: 100 }] },
  { amount_due: 0, payments: [payment(100, "2026-02-30")] },
  { amount_due: 0, payments: [payment(100, "2026-09-01", { legacy_inferred: true })] },
  { amount_due: 0, payments: [payment(100, "2026-09-01", { method: "legacy_balance" })] },
  { amount_due: 0, payments: [payment(20)] },
  { amount_due: 0, payments: [payment(100, "2026-09-01", { currency: "EUR" })] },
  { amount_due: 80, payments: [payment(100)] },
  { payments: { amount: 100, date: "2026-09-01" } },
])("marks incomplete/inconsistent cash evidence unavailable: %j", async extra => {
  const result = await report([sale(extra)])
  expect(result.financialSummary).toMatchObject({ receipts: null, netCollected: null, cashIssues: 1 })
})

it("keeps unknown balances unavailable rather than assuming missing amount_due means paid", async () => {
  const result = await report([sale({ amount_due: null, payments: [payment(20)] })])
  expect(result.financialSummary).toMatchObject({
    receipts: { actual: 20 }, outstanding: { amount: null, unknownSaleCount: 1 }, paymentStatus: { unknown: { count: 1 } },
  })
})

it("deduplicates identical receipt/refund IDs and rejects conflicting ones", () => {
  const paid = sale({ amount_due: 0, payments: [payment(100, "2026-09-01", { id: "p" }), payment(100, "2026-09-01", { id: "p" })],
    refunds: [refund(20), refund(20)] })
  expect(salePaymentLedger(paid)).toMatchObject({
    receiptIssue: false, refundIssue: false, receipts: [{ amount: 10000 }], refunds: [{ amount: 2000 }],
  })
  expect(salePaymentLedger({ ...paid, refunds: [refund(20), refund(30)] }).refundIssue).toBe(true)
  expect(salePaymentLedger({ ...paid, payments: [payment(100, "2026-09-01", { id: "p" }), payment(20, "2026-09-01", { id: "p" })] }).receiptIssue).toBe(true)
})

it("subtracts partial refunds and preserves overpayments without altering active sale value", async () => {
  const result = await report([sale({ amount: 80, amount_due: 0, payments: [payment(100)], refunds: [refund(20)] })])
  expect(result.totalSales.actual).toBe(80)
  expect(result.financialSummary).toMatchObject({ receipts: { actual: 100 }, refunds: { actual: 20 }, netCollected: { actual: 80 } })
})

it.each([
  { status: "refunded", refunds: [] },
  { refunds: [refund(110)] },
  { refunds: [refund(20, "2026-08-01")] },
  { refunds: [refund(20, "2026-09-02", { currency: "EUR" })] },
])("does not invent refunds or accept invalid refund evidence: %j", async extra => {
  const result = await report([sale({ amount_due: 0, payments: [payment(100)], ...extra })])
  expect(result.financialSummary).toMatchObject({ refunds: null, netCollected: null, cashIssues: 1 })
})

it("uses cent precision and keeps cash-only currencies separate", async () => {
  const rows = [sale({ amount: 0.1, amount_due: 0, payments: [payment(0.1)] }),
    sale({ id: "two", amount: 0.2, amount_due: 0, payments: [payment(0.2)] }),
    sale({ id: "eur", currency: "EUR", sale_date: "2025-01-01", amount_due: 0, payments: [payment(100)] })]
  await expect(report(rows)).rejects.toThrow("multiple currencies")
  const result = await buildSalesReport(salesTestClient({}), rows, period, { ...options, currency: "USD" })
  expect(result.totalSales.actual).toBe(0.3)
  expect(result.financialSummary?.netCollected?.actual).toBe(0.3)
  expect(result.availableCurrencies).toEqual(["EUR", "USD"])
})

it("applies exact sale-date bounds with creation-date fallback only when missing", async () => {
  const result = await report([
    sale({ id: "fallback", sale_date: null }),
    sale({ id: "explicit-old", sale_date: "2025-01-01" }),
    sale({ id: "next", sale_date: "2026-09-03" }),
    sale({ id: "previous", sale_date: "2026-08-31" }),
  ])
  expect(result.totalSales).toMatchObject({ actual: 100, previous: 100 })
})