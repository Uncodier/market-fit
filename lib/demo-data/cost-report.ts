import { buildCostReport } from "@/app/api/costs/cost-report"
import { selectCostCurrency, costCurrencyBucket } from "@/app/api/costs/cost-currency"
import { MAX_COST_PERIOD_DAYS, shiftCostDay, type CostReportInput } from "@/app/api/costs/cost-input"
import { mapPurchasesToCostRows, shouldIncludeBillsInCostReport, isBillIncludedInCosts, getTransactionAmount } from "@/lib/costs/aggregate-costs"
import { demoReportContext } from "./report-context"

export async function loadDemoCostReport(params: URLSearchParams) {
  const { siteId, period, segmentId, rows, currency: siteCurrency } = await demoReportContext(params, MAX_COST_PERIOD_DAYS)
  const campaignId = params.get("campaignId") || "all"
  const currency = params.get("currency") || siteCurrency
  if (currency && !/^(?:[A-Z]{3}|UNSPECIFIED)$/.test(currency)) throw new Error("Invalid report currency")
  const monthlyDate = new Date(`${period.end.slice(0, 7)}-01T00:00:00Z`)
  monthlyDate.setUTCMonth(monthlyDate.getUTCMonth() - 5)
  const monthlyStart = monthlyDate.toISOString().slice(0, 10)
  const input: CostReportInput = {
    siteId, segmentId, campaignId, currency, start: period.start, end: period.end, days: period.days,
    monthlyStart, previousStart: period.previousStart, previousEnd: period.previousEnd,
    endExclusive: shiftCostDay(period.end, 1),
    queryStart: period.previousStart < monthlyStart ? period.previousStart : monthlyStart,
  }
  const inWindow = (date: string) => date.slice(0, 10) >= input.queryStart && date.slice(0, 10) < input.endExclusive
  const campaignIds = new Set(rows("campaign_segments").filter(row => row.segment_id === segmentId).map(row => row.campaign_id))
  const transactions = rows("transactions").filter(row => inWindow(String(row.date || "")) &&
    (campaignId === "all" || row.campaign_id === campaignId) &&
    (segmentId === "all" || row.segment_id === segmentId || campaignIds.has(row.campaign_id))).map(row => ({
      ...row, amount: row.amount ?? null, date: String(row.date),
      category: typeof row.category === "string" ? row.category : null,
    }))
  const purchases = shouldIncludeBillsInCostReport(campaignId, segmentId)
    ? rows("purchases").filter(row => inWindow(String(row.purchase_date || "")) &&
      isBillIncludedInCosts(row.status) && getTransactionAmount(row) > 0).map(row => ({
        ...row, amount: row.amount ?? null, purchase_date: String(row.purchase_date),
      })) : []
  const selection = selectCostCurrency([...transactions, ...purchases], currency)
  const selectedPurchases = purchases.filter(row => costCurrencyBucket(row.currency) === selection.currency)
  const items = rows("purchase_items").map(row => ({
    purchase_id: String(row.purchase_id), catalog_item_id: String(row.catalog_item_id || ""),
    subtotal: typeof row.subtotal === "number" || typeof row.subtotal === "string" ? row.subtotal : null,
    catalog_items: { kind: (() => {
      const kind = rows("catalog_items").find(item => item.id === row.catalog_item_id)?.kind
      return typeof kind === "string" ? kind : null
    })() },
  }))
  return buildCostReport([
    ...transactions.filter(row => costCurrencyBucket(row.currency) === selection.currency),
    ...mapPurchasesToCostRows(selectedPurchases, items),
  ], selection.currency, input, selection.availableCurrencies)
}