import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BILL_COST_STATUSES, getTransactionAmount, mapPurchasesToCostRows,
  shouldIncludeBillsInCostReport,
  type CostTransaction, type PurchaseCostRow, type PurchaseItemCostRow,
} from "@/lib/costs/aggregate-costs"
import { CostReportError, type CostReportInput } from "./cost-input"
import { costCurrencyBucket, selectCostCurrency } from "./cost-currency"
import {
  consumeCostQuery, COST_ITEM_BATCH_SIZE, MAX_COST_ITEM_ROWS, MAX_COST_QUERIES,
  readCostPages, type CostQueryBudget,
} from "./cost-paging"

type Transaction = CostTransaction & { id: string; currency?: string | null }
type Purchase = PurchaseCostRow & { currency?: string | null }
type Item = PurchaseItemCostRow & { id: string }
const TRANSACTION_COLUMNS = "id, type, amount, category, date, campaign_id, segment_id, currency"
const PURCHASE_COLUMNS = "id, amount, purchase_date, status, currency"
const ITEM_COLUMNS = "id, purchase_id, catalog_item_id, subtotal, quantity, unit_cost, catalog_items(kind)"

async function validateFilterSite(
  client: SupabaseClient, input: CostReportInput, budget: CostQueryBudget,
) {
  for (const [table, id] of [["segments", input.segmentId], ["campaigns", input.campaignId]]) {
    if (id === "all") continue
    consumeCostQuery(budget)
    const { data, error } = await client.from(table).select("id")
      .eq("site_id", input.siteId).eq("id", id).maybeSingle()
    if (error) throw new CostReportError("Failed to validate cost report filters. Please try again.")
    if (!data) throw new CostReportError("The requested filter is not available for this site", 403)
  }
}

export async function loadCostData(client: SupabaseClient, input: CostReportInput) {
  const budget = { remaining: MAX_COST_QUERIES }
  await validateFilterSite(client, input, budget)
  const campaignIds = new Set<string>()
  if (input.segmentId !== "all") {
    const links = await readCostPages<{ campaign_id: string }>((after, limit) => {
      let query = client.from("campaign_segments").select("campaign_id, campaigns!inner(site_id)")
        .eq("segment_id", input.segmentId).eq("campaigns.site_id", input.siteId)
        .order("campaign_id", { ascending: true }).limit(limit)
      if (after) query = query.gt("campaign_id", after)
      return query
    }, (row) => row.campaign_id, budget)
    for (const link of links) campaignIds.add(link.campaign_id)
  }

  // One bounded scan covers current, previous and monthly windows. A primary-key
  // cursor is stable across equal dates and avoids expensive growing offsets.
  const transactions = await readCostPages<Transaction>((after, limit) => {
    let query = client.from("transactions").select(TRANSACTION_COLUMNS)
      .eq("site_id", input.siteId).gte("date", input.queryStart).lt("date", input.endExclusive)
      .order("id", { ascending: true }).limit(limit)
    if (input.campaignId !== "all") query = query.eq("campaign_id", input.campaignId)
    if (after) query = query.gt("id", after)
    return query
  }, (row) => row.id, budget)

  // Resolve segment attribution locally to avoid an unbounded campaign IN/OR URL.
  // The scan cap applies before filtering, so large sites fail rather than truncate.
  const scopedTransactions = transactions.filter((row) => input.segmentId === "all" ||
    row.segment_id === input.segmentId || (row.campaign_id && campaignIds.has(row.campaign_id)))
  let purchases: Purchase[] = []
  if (shouldIncludeBillsInCostReport(input.campaignId, input.segmentId)) {
    purchases = await readCostPages<Purchase>((after, limit) => {
      let query = client.from("purchases").select(PURCHASE_COLUMNS)
        .eq("site_id", input.siteId).in("status", [...BILL_COST_STATUSES])
        .gte("purchase_date", input.queryStart).lt("purchase_date", input.endExclusive)
        .order("id", { ascending: true }).limit(limit)
      if (after) query = query.gt("id", after)
      return query
    }, (row) => row.id, budget)
  }
  // Match the shared bill mapper: non-positive bills do not contribute costs.
  const includedPurchases = purchases.filter((purchase) => getTransactionAmount(purchase) > 0)
  const { currency, availableCurrencies } = selectCostCurrency(
    [...scopedTransactions, ...includedPurchases], input.currency,
  )
  // Discover all choices from the complete scoped union, then apply one currency
  // consistently to every period and to bills before loading their line items.
  const selectedTransactions = scopedTransactions.filter((row) => costCurrencyBucket(row.currency) === currency)
  const selectedPurchases = includedPurchases.filter((row) => costCurrencyBucket(row.currency) === currency)
  const items: Item[] = []
  for (let offset = 0; offset < selectedPurchases.length; offset += COST_ITEM_BATCH_SIZE) {
    const ids = selectedPurchases.slice(offset, offset + COST_ITEM_BATCH_SIZE).map((row) => row.id)
    const batch = await readCostPages<Item>((after, limit) => {
      let query = client.from("purchase_items").select(ITEM_COLUMNS)
        .eq("site_id", input.siteId).in("purchase_id", ids)
        .order("id", { ascending: true }).limit(limit)
      if (after) query = query.gt("id", after)
      return query
    }, (row) => row.id, budget, MAX_COST_ITEM_ROWS - items.length)
    items.push(...batch)
  }
  return {
    currency, availableCurrencies,
    rows: [...selectedTransactions, ...mapPurchasesToCostRows(selectedPurchases, items)],
  }
}