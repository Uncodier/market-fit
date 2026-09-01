import { DEFAULT_CHART } from "@/app/accounting/default-chart"

const EXCLUDED_SALE_STATUSES = new Set(["cancelled", "refunded"])

const EXPENSE_KEY_ALIASES: Record<string, string> = {
  freelance: "freelancers",
  freelancer: "freelancers",
  ads: "advertising",
  ad: "advertising",
  promo: "promotions",
  salary: "salaries",
  ops: "operating",
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isRecognizedSale(sale: { status?: string | null }) {
  const status = (sale?.status || "").toLowerCase()
  if (!status || EXCLUDED_SALE_STATUSES.has(status)) return false
  return status === "completed" || status === "pending"
}

function paidOnSale(sale: any): number {
  const total = Number(sale.amount) || 0
  if (sale.amount_due != null && sale.amount_due !== "") {
    return Math.max(0, total - Number(sale.amount_due))
  }
  const fromPayments = (sale.payments || []).reduce(
    (sum: number, payment: { amount?: number }) => sum + (Number(payment?.amount) || 0),
    0
  )
  if (fromPayments > 0) return fromPayments
  return (sale.status || "").toLowerCase() === "completed" ? total : 0
}

function expenseAccountCode(category: string | null | undefined, keyToCode: Map<string, string>) {
  const raw = (category || "other").toLowerCase()
  const key = EXPENSE_KEY_ALIASES[raw] || raw
  return keyToCode.get(key) || keyToCode.get("other") || "5900"
}

function makeChart(siteId: string) {
  const now = new Date().toISOString()
  return DEFAULT_CHART.map((account) => ({
    id: `acct-${siteId}-${account.code}`,
    site_id: siteId,
    code: account.code,
    key: account.key || null,
    type: account.type,
    label: account.label,
    system: account.system,
    active: true,
    created_at: now,
    updated_at: now,
  }))
}

function pushLines(
  lines: any[],
  entryId: string,
  siteId: string,
  dims: Record<string, unknown>,
  accountCode: string,
  debit: number,
  credit: number
) {
  if (debit <= 0 && credit <= 0) return
  lines.push({
    id: `jl-${entryId}-${accountCode}-${debit > 0 ? "d" : "c"}`,
    entry_id: entryId,
    site_id: siteId,
    account_code: accountCode,
    debit,
    credit,
    location_id: dims.location_id || null,
    lead_id: dims.lead_id || null,
    campaign_id: dims.campaign_id || null,
    segment_id: dims.segment_id || null,
    catalog_item_id: dims.catalog_item_id || null,
    catalog_category_id: dims.catalog_category_id || null,
    company_id: dims.company_id || null,
  })
}

function postSale(sale: any, entries: any[], lines: any[]) {
  if (!isRecognizedSale(sale)) return
  const total = round2(Number(sale.amount) || 0)
  if (total <= 0) return

  const paid = round2(Math.min(total, paidOnSale(sale)))
  const due = round2(Math.max(0, total - paid))
  const entryId = `je-sale-${sale.id}`
  const dims = {
    location_id: sale.location_id || null,
    lead_id: sale.lead_id || null,
    campaign_id: sale.campaign_id || null,
    segment_id: sale.segment_id || null,
    company_id: sale.company_id || null,
  }

  entries.push({
    id: entryId,
    site_id: sale.site_id,
    entry_date: sale.sale_date || String(sale.created_at || "").slice(0, 10),
    memo: sale.product_name || sale.title || `Sale ${sale.id}`,
    source_type: "sale",
    source_id: sale.id,
    idempotency_key: `sale:${sale.id}`,
    source_hash: `demo-sale-${sale.id}-${total}`,
    currency: sale.currency || "USD",
    created_at: sale.created_at || new Date().toISOString(),
  })

  pushLines(lines, entryId, sale.site_id, dims, "1000", paid, 0)
  pushLines(lines, entryId, sale.site_id, dims, "1100", due, 0)
  pushLines(lines, entryId, sale.site_id, dims, "4000", 0, total)
}

function postExpense(tx: any, entries: any[], lines: any[], keyToCode: Map<string, string>) {
  const amount = round2(Number(tx.amount) || 0)
  if (amount <= 0) return

  const entryId = `je-exp-${tx.id}`
  const dims = {
    location_id: tx.location_id || null,
    lead_id: tx.lead_id || null,
    campaign_id: tx.campaign_id || null,
    segment_id: tx.segment_id || null,
    catalog_item_id: tx.catalog_item_id || null,
    catalog_category_id: tx.catalog_category_id || null,
    company_id: tx.company_id || null,
  }

  entries.push({
    id: entryId,
    site_id: tx.site_id,
    entry_date: tx.date || String(tx.created_at || "").slice(0, 10),
    memo: tx.description || tx.category || `Expense ${tx.id}`,
    source_type: "expense",
    source_id: tx.id,
    idempotency_key: `expense:${tx.id}`,
    source_hash: `demo-exp-${tx.id}-${amount}`,
    currency: tx.currency || "USD",
    created_at: tx.created_at || new Date().toISOString(),
  })

  pushLines(lines, entryId, tx.site_id, dims, expenseAccountCode(tx.category, keyToCode), amount, 0)
  pushLines(lines, entryId, tx.site_id, dims, "1000", 0, amount)
}

export function attachDemoAccounting(data: Record<string, any>): Record<string, any> {
  const siteId = data.sites?.[0]?.id
  if (!siteId) return data

  const chart = makeChart(siteId)
  const keyToCode = new Map<string, string>()
  for (const account of chart) {
    if (account.key) keyToCode.set(account.key, account.code)
  }

  const entries: any[] = []
  const lines: any[] = []
  for (const sale of data.sales || []) postSale(sale, entries, lines)
  for (const tx of data.transactions || []) postExpense(tx, entries, lines, keyToCode)

  return {
    ...data,
    accounting_accounts: chart,
    journal_entries: entries,
    journal_lines: lines,
  }
}
