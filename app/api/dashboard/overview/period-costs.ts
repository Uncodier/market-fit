import type { SupabaseClient } from "@supabase/supabase-js"
import type { SalesReportData } from "@/lib/sales/report-types"
import { calendarDay, type SalesReportPeriod } from "@/lib/sales/report-period"
import { salesCurrency } from "@/lib/sales/report-format"
import { CostReportError } from "@/app/api/costs/cost-input"
import { consumeCostQuery, MAX_COST_QUERIES, readCostPages } from "@/app/api/costs/cost-paging"

type Period = Pick<SalesReportPeriod, "start" | "end" | "endExclusive">
export type OverviewCostTransaction = {
  date: string
  amount: number | string | null
  type?: string | null
  category?: string | null
  currency?: string | null
  sale_order_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
}
export type OverviewCostPurchase = {
  purchase_date: string
  amount: number | string | null
  status: string
  currency?: string | null
}
type Transaction = OverviewCostTransaction & { id: string }
type Purchase = OverviewCostPurchase & { id: string }
const EXPENSE_TYPES = new Set(["expense", "expenses", "fixed", "variable"])
const PURCHASE_STATUSES = ["pending", "completed"]
const TRANSACTION_COLUMNS = "id, type, amount, category, date, campaign_id, segment_id, currency, sale_order_id"
const PURCHASE_COLUMNS = "id, amount, purchase_date, status, currency"

function costCents(value: number | string | null): number {
  if (typeof value !== "number" && (typeof value !== "string" ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) {
    throw new CostReportError("Invalid Overview period cost amount")
  }
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new CostReportError("Invalid Overview period cost amount")
  const cents = Math.round(amount * 100)
  if (!Number.isSafeInteger(cents)) throw new CostReportError("Invalid Overview period cost amount")
  return cents
}

/** Inputs must be complete scans; segment expense attribution is resolved by the caller. */
export function buildOverviewPeriodCosts(
  transactions: readonly OverviewCostTransaction[],
  purchases: readonly OverviewCostPurchase[],
  period: Period,
  currency: string,
  segmentId: string,
): NonNullable<SalesReportData["periodCosts"]> {
  const selectedCurrency = salesCurrency(currency)
  const daily = new Map<string, { date: string; expenses: number; purchases: number }>()
  const add = (date: string, value: number | string | null, series: "expenses" | "purchases") => {
    const day = calendarDay(date)
    if (day < period.start || day >= period.endExclusive) return
    const amount = costCents(value)
    if (amount === 0) return
    const point = daily.get(day) ?? { date: day, expenses: 0, purchases: 0 }
    point[series] += amount
    if (!Number.isSafeInteger(point[series])) throw new CostReportError("Invalid Overview period cost total")
    daily.set(day, point)
  }
  for (const row of transactions) {
    if (salesCurrency(row.currency) !== selectedCurrency ||
        (row.type != null && !EXPENSE_TYPES.has(row.type)) ||
        (row.category === "promotions" && row.sale_order_id != null)) continue
    add(row.date, row.amount, "expenses")
  }
  for (const row of purchases) {
    if (salesCurrency(row.currency) !== selectedCurrency || !PURCHASE_STATUSES.includes(row.status)) continue
    add(row.purchase_date, row.amount, "purchases")
  }
  return {
    dailyData: [...daily.values()].filter(row => row.expenses !== 0 || row.purchases !== 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({ date: row.date, expenses: row.expenses / 100, purchases: row.purchases / 100 })),
    coverage: { startDate: period.start, endDate: period.end, complete: true },
    expensesScope: segmentId === "all" ? "site" : "segment",
    purchasesScope: "site",
    currency: selectedCurrency,
  }
}

/** Current source dates only, user-scoped RLS, no inventory allocation or ledger reads. */
export async function loadOverviewPeriodCosts(
  client: SupabaseClient,
  siteId: string,
  segmentId: string,
  period: Period,
  currency: string,
) {
  const budget = { remaining: MAX_COST_QUERIES }
  const campaignIds = new Set<string>()
  if (segmentId !== "all") {
    consumeCostQuery(budget)
    const { data, error } = await client.from("segments").select("id")
      .eq("site_id", siteId).eq("id", segmentId).maybeSingle()
    if (error) throw new CostReportError("Failed to validate Overview period cost filters")
    if (!data) throw new CostReportError("The requested segment is not available for this site", 403)
    const links = await readCostPages<{ campaign_id: string }>((after, limit) => {
      let query = client.from("campaign_segments").select("campaign_id, campaigns!inner(site_id)")
        .eq("segment_id", segmentId).eq("campaigns.site_id", siteId)
        .order("campaign_id", { ascending: true }).limit(limit)
      if (after) query = query.gt("campaign_id", after)
      return query
    }, row => row.campaign_id, budget)
    for (const link of links) campaignIds.add(link.campaign_id)
  }
  // Filter currency/segment locally: legacy currencies need salesCurrency normalization,
  // and campaign attribution must not create an unbounded IN/OR request URL.
  const transactions = await readCostPages<Transaction>((after, limit) => {
    let query = client.from("transactions").select(TRANSACTION_COLUMNS)
      .eq("site_id", siteId).gte("date", period.start).lt("date", period.endExclusive)
      .order("id", { ascending: true }).limit(limit)
    if (after) query = query.gt("id", after)
    return query
  }, row => row.id, budget)
  const purchases = await readCostPages<Purchase>((after, limit) => {
    let query = client.from("purchases").select(PURCHASE_COLUMNS)
      .eq("site_id", siteId).in("status", PURCHASE_STATUSES)
      .gte("purchase_date", period.start).lt("purchase_date", period.endExclusive)
      .order("id", { ascending: true }).limit(limit)
    if (after) query = query.gt("id", after)
    return query
  }, row => row.id, budget)
  const expenses = transactions.filter(row => segmentId === "all" || row.segment_id === segmentId ||
    (row.campaign_id != null && campaignIds.has(row.campaign_id)))
  return buildOverviewPeriodCosts(expenses, purchases, period, currency, segmentId)
}