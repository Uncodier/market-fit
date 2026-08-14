import { addDays, format, parseISO, subMonths } from "date-fns"

export type CostTransaction = {
  type?: string | null
  amount: number | string | null
  category?: string | null
  date: string
  campaign_id?: string | null
  segment_id?: string | null
}

export const CATEGORY_GROUPS: Record<string, string> = {
  advertising: "Marketing",
  promotions: "Marketing",
  content: "Marketing",
  adspend: "Marketing",
  seo: "Marketing",
  social: "Marketing",
  email: "Marketing",
  events: "Marketing",
  print: "Marketing",
  sponsorship: "Marketing",
  sales_commission: "Sales",
  sales_travel: "Sales",
  crm: "Sales",
  software: "Technology",
  hosting: "Technology",
  tools: "Technology",
  freelance: "Operations",
  freelancers: "Operations",
  agency: "Operations",
  consulting: "Operations",
  research: "Operations",
  utilities: "Operations",
  rent: "Operations",
  operating: "Operations",
  salaries: "Administration",
  insurance: "Administration",
  legal: "Administration",
  travel: "Administration",
  training: "Administration",
  cogs: "Cost of goods sold",
  cost_of_goods_sold: "Cost of goods sold",
  other: "Other",
}

export function getTransactionAmount(tx: { amount?: number | string | null }): number {
  if (tx?.amount == null) return 0
  const amount =
    typeof tx.amount === "number"
      ? tx.amount
      : parseFloat(String(tx.amount).replace(/[^0-9.-]+/g, ""))
  return Number.isFinite(amount) ? amount : 0
}

export function getCategoryGroup(category?: string | null): string {
  if (!category) return "Other"
  const key = category.trim().toLowerCase().replace(/\s+/g, "_")
  return CATEGORY_GROUPS[key] || "Other"
}

export function percentChangeFrom(previous: number, current: number): number {
  if (previous > 0) return ((current - previous) / previous) * 100
  if (current > 0) return 100
  return 0
}

export function parseTransactionDate(date: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return parseISO(date)
}

export function parseDateParam(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseTransactionDate(trimmed)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? fallback : parseTransactionDate(toDateOnly(parsed))
}

export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function exclusiveEndDate(date: Date): string {
  return format(addDays(date, 1), "yyyy-MM-dd")
}

export function addCalendarDays(dateStr: string, days: number): string {
  return toDateOnly(addDays(parseTransactionDate(dateStr), days))
}

/** Inclusive end plus one UTC-calendar day so evening local expenses stored via toISOString() stay in range. */
export function inclusiveEndWithUtcSlack(endDateStr: string): string {
  return addCalendarDays(endDateStr, 1)
}

export function sumCosts(transactions: CostTransaction[]): number {
  return transactions.reduce((sum, tx) => sum + getTransactionAmount(tx), 0)
}

export function aggregateByCategory(transactions: CostTransaction[]): Map<string, number> {
  const categories = new Map<string, number>()
  for (const tx of transactions) {
    const group = getCategoryGroup(tx.category)
    categories.set(group, (categories.get(group) || 0) + getTransactionAmount(tx))
  }
  return categories
}

export function buildCostCategories(
  current: Map<string, number>,
  previous: Map<string, number>
) {
  return Array.from(current.entries()).map(([name, amount]) => {
    const prevAmount = previous.get(name) || 0
    return {
      name,
      amount,
      prevAmount,
      percentChange: parseFloat(percentChangeFrom(prevAmount, amount).toFixed(1)),
    }
  })
}

export function buildCostDistribution(categories: Map<string, number>, total: number) {
  return Array.from(categories.entries()).map(([category, amount]) => ({
    category,
    percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    amount,
  }))
}

export function buildMonthlyCostData(
  transactions: CostTransaction[],
  months = 6,
  now = new Date()
) {
  const monthlyData: Array<{ month: string; fixedCosts: number; variableCosts: number }> = []

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const month = monthDate.toLocaleString("en-US", { month: "short" })
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)

    let fixedCosts = 0
    let variableCosts = 0

    for (const tx of transactions) {
      const txDate = parseTransactionDate(tx.date)
      if (txDate < monthStart || txDate > monthEnd) continue
      const amount = getTransactionAmount(tx)
      if (tx.type === "fixed") fixedCosts += amount
      else variableCosts += amount
    }

    monthlyData.push({ month, fixedCosts, variableCosts })
  }

  return monthlyData
}

export function marketingFromCategories(
  categories: Array<{ name: string; amount: number; prevAmount: number; percentChange: number }>
) {
  return (
    categories.find((category) => category.name === "Marketing") || {
      name: "Marketing",
      amount: 0,
      prevAmount: 0,
      percentChange: 0,
    }
  )
}

export function overheadFromCategories(
  categories: Array<{ name: string; amount: number; prevAmount: number }>
) {
  const admin = categories.find((category) => category.name === "Administration")
  const operations = categories.find((category) => category.name === "Operations")
  const amount = (admin?.amount || 0) + (operations?.amount || 0)
  const prevAmount = (admin?.prevAmount || 0) + (operations?.prevAmount || 0)
  return {
    amount,
    prevAmount,
    percentChange: percentChangeFrom(prevAmount, amount),
  }
}

export function efficiencyRatio(revenue: number, cost: number): number {
  return cost > 0 ? revenue / cost : 0
}

export function periodTypeFromDays(daysDiff: number): string {
  if (daysDiff <= 1) return "daily"
  if (daysDiff <= 7) return "weekly"
  if (daysDiff <= 31) return "monthly"
  if (daysDiff <= 92) return "quarterly"
  return "yearly"
}

export const BILL_COST_STATUSES = ["pending", "completed"] as const

export type PurchaseCostRow = {
  id: string
  amount: number | string | null
  purchase_date: string
  status?: string | null
}

export type PurchaseItemCostRow = {
  purchase_id: string
  catalog_item_id?: string | null
  subtotal?: number | string | null
  quantity?: number | string | null
  unit_cost?: number | string | null
  catalog_items?: { kind?: string | null } | Array<{ kind?: string | null }> | null
}

export function shouldIncludeBillsInCostReport(
  campaignId?: string | null,
  segmentId?: string | null
): boolean {
  const campaignAll = !campaignId || campaignId === "all"
  const segmentAll = !segmentId || segmentId === "all"
  return campaignAll && segmentAll
}

export function isBillIncludedInCosts(status?: string | null): boolean {
  return status === "pending" || status === "completed"
}

export function costRowsInRange(
  rows: CostTransaction[],
  startDate: string,
  endInclusive: string
): CostTransaction[] {
  return rows.filter((row) => {
    const date = String(row.date || "").slice(0, 10)
    return date >= startDate && date <= endInclusive
  })
}

function catalogItemKind(item: PurchaseItemCostRow): string | null {
  const related = item.catalog_items
  if (Array.isArray(related)) return related[0]?.kind ?? null
  return related?.kind ?? null
}

function purchaseItemAmount(item: PurchaseItemCostRow): number {
  if (item.subtotal != null) return getTransactionAmount({ amount: item.subtotal })
  return getTransactionAmount({
    amount: (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0),
  })
}

export function mapPurchasesToCostRows(
  purchases: PurchaseCostRow[],
  items: PurchaseItemCostRow[] = []
): CostTransaction[] {
  const itemsByPurchase = new Map<string, PurchaseItemCostRow[]>()
  for (const item of items) {
    const list = itemsByPurchase.get(item.purchase_id) || []
    list.push(item)
    itemsByPurchase.set(item.purchase_id, list)
  }

  const rows: CostTransaction[] = []
  for (const purchase of purchases) {
    if (!isBillIncludedInCosts(purchase.status)) continue
    const total = getTransactionAmount(purchase)
    if (total <= 0) continue

    let cogs = 0
    for (const item of itemsByPurchase.get(purchase.id) || []) {
      const line = purchaseItemAmount(item)
      if (item.catalog_item_id && catalogItemKind(item) === "product" && line > 0) {
        cogs += line
      }
    }
    if (cogs > total) cogs = total
    const operating = total - cogs

    if (cogs > 0) {
      rows.push({
        amount: cogs,
        category: "cogs",
        date: purchase.purchase_date,
        type: "variable",
      })
    }
    if (operating > 0) {
      rows.push({
        amount: operating,
        category: "operating",
        date: purchase.purchase_date,
        type: "variable",
      })
    }
  }
  return rows
}
