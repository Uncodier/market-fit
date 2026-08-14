import { JournalEntry, JournalLine } from '../types'
import crypto from 'crypto'
import { isRecognizedRevenueSale } from '@/lib/sales/recognized-sale'
import { paidOnSale } from '@/app/promotions/sale-amounts-after-discount'
import { memoFromExpense, memoFromPurchase, memoFromSale } from "./journal-memo"

function hashSource(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Raw sale row from Supabase (snake_case). */
export interface SaleSource {
  id: string
  site_id: string
  status: string
  amount: number
  amount_due: number
  sale_date: string
  currency?: string | null
  location_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  company_id?: string | null
  accounting_state?: string
  title?: string | null
  product_name?: string | null
  invoice_number?: string | number | null
  reference_code?: string | null
  payments?: Array<{ amount?: number | string | null }> | null
  leads?: { name?: string | null } | Array<{ name?: string | null }> | null
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null
}

/** Raw sale_order row from Supabase (snake_case). */
export interface SaleOrderSource {
  tax_total?: number | null
  taxTotal?: number | null
  sale_order_items?: Array<{
    catalog_item_id?: string | null
    catalog_items?: {
      category_id?: string | null
      catalog_categories?: {
        income_account_key?: string | null
      } | null
    } | null
  }> | null
}

/** Raw expense/transaction row from Supabase (snake_case). */
export interface ExpenseSource {
  id: string
  site_id: string
  amount: number
  category: string
  date: string
  currency: string
  description?: string | null
  location_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  catalog_item_id?: string | null
  catalog_category_id?: string | null
  company_id?: string | null
  accounting_state?: string
  catalog_category?: {
    cogs_account_key?: string | null
  } | null
}

export type JournalDraft = {
  entry: Partial<JournalEntry>
  lines: Partial<JournalLine>[]
}

/** Resolve a single income account code when all order lines share one category key. */
export function resolveSaleIncomeAccountCode(
  order: SaleOrderSource | null,
  incomeCodeMap: Map<string, string>
): string {
  const items = order?.sale_order_items || []
  if (items.length === 0) return '4000'

  const keys = new Set<string>()
  for (const item of items) {
    const cat = item.catalog_items?.catalog_categories
    const key = cat?.income_account_key || 'revenue'
    keys.add(key)
  }

  if (keys.size !== 1) return '4000'
  const onlyKey = [...keys][0]
  return incomeCodeMap.get(onlyKey) || '4000'
}

export function buildFromSale(
  sale: SaleSource,
  order: SaleOrderSource | null,
  incomeCodeMap: Map<string, string> = new Map([['revenue', '4000']])
): JournalDraft | null {
  if (!isRecognizedRevenueSale(sale)) {
    return null
  }

  const totalAmount = Number(sale.amount) || 0
  const paidAmount = round2(Math.min(totalAmount, paidOnSale(sale)))
  const amountDue = round2(Math.max(0, totalAmount - paidAmount))
  const taxTotal = Number(order?.tax_total ?? order?.taxTotal ?? 0) || 0
  const revenue = round2(totalAmount - taxTotal)
  const locId = sale.location_id || null
  const leadId = sale.lead_id || null
  const campaignId = sale.campaign_id || null
  const segmentId = sale.segment_id || null
  const companyId = sale.company_id || null
  const incomeAccountCode = resolveSaleIncomeAccountCode(order, incomeCodeMap)

  const entry: Partial<JournalEntry> = {
    siteId: sale.site_id,
    entryDate: sale.sale_date,
    memo: memoFromSale(sale),
    sourceType: 'sale',
    sourceId: sale.id,
    idempotencyKey: `sale:${sale.id}`,
    currency: sale.currency || 'USD',
    sourceHash: hashSource({
      status: sale.status,
      amount: totalAmount,
      amount_due: amountDue,
      tax_total: taxTotal,
      location_id: locId,
      lead_id: leadId,
      campaign_id: campaignId,
      segment_id: segmentId,
      company_id: companyId,
      income_account_code: incomeAccountCode,
      date: sale.sale_date,
    }),
  }

  const baseLineDims = {
    locationId: locId,
    leadId,
    campaignId,
    segmentId,
    companyId
  }

  const lines: Partial<JournalLine>[] = []

  if (paidAmount > 0) {
    lines.push({ accountCode: '1000', debit: paidAmount, credit: 0, ...baseLineDims })
  }
  if (amountDue > 0) {
    lines.push({ accountCode: '1100', debit: amountDue, credit: 0, ...baseLineDims })
  }
  // Fully unpaid with zero paid: still need DR AR for full amount (covered by amountDue)
  // Fully paid: only cash line above

  lines.push({ accountCode: incomeAccountCode, debit: 0, credit: revenue, ...baseLineDims })

  if (taxTotal > 0) {
    lines.push({ accountCode: '2100', debit: 0, credit: taxTotal, ...baseLineDims })
  }

  const sumDebits = round2(lines.reduce((acc, l) => acc + (l.debit || 0), 0))
  const sumCredits = round2(lines.reduce((acc, l) => acc + (l.credit || 0), 0))

  if (Math.abs(sumDebits - sumCredits) > 0.01) {
    console.error('Unbalanced sale entry:', sumDebits, sumCredits, sale.id)
    return null
  }

  return { entry, lines }
}

/**
 * Account key for an expense.
 * `tx.category` is the source of truth; catalog `cogs_account_key` overrides when category is cogs.
 */
export function resolveExpenseAccountKey(tx: ExpenseSource): string {
  const categoryKey = tx.category || 'other'
  if (categoryKey === 'cogs' && tx.catalog_category?.cogs_account_key) {
    return tx.catalog_category.cogs_account_key
  }
  return categoryKey
}

export function buildFromExpense(tx: ExpenseSource, expenseCodeMap: Map<string, string>): JournalDraft | null {
  const amount = Number(tx.amount) || 0
  if (amount <= 0) return null

  const locId = tx.location_id || null
  const leadId = tx.lead_id || null
  const campaignId = tx.campaign_id || null
  const segmentId = tx.segment_id || null
  const catalogItemId = tx.catalog_item_id || null
  const catalogCategoryId = tx.catalog_category_id || null
  const companyId = tx.company_id || null

  const accountKey = resolveExpenseAccountKey(tx)
  const accountCode = expenseCodeMap.get(accountKey) || expenseCodeMap.get('other') || '5900'

  const entry: Partial<JournalEntry> = {
    siteId: tx.site_id,
    entryDate: tx.date,
    memo: memoFromExpense(tx),
    sourceType: 'expense',
    sourceId: tx.id,
    idempotencyKey: `expense:${tx.id}`,
    currency: tx.currency,
    sourceHash: hashSource({
      amount,
      category: tx.category,
      account_key: accountKey,
      date: tx.date,
      location_id: locId,
      lead_id: leadId,
      campaign_id: campaignId,
      segment_id: segmentId,
      catalog_item_id: catalogItemId,
      catalog_category_id: catalogCategoryId,
      company_id: companyId,
    }),
  }

  const baseLineDims = {
    locationId: locId,
    leadId,
    campaignId,
    segmentId,
    catalogItemId,
    catalogCategoryId,
    companyId
  }

  return {
    entry,
    lines: [
      { accountCode, debit: amount, credit: 0, ...baseLineDims },
      { accountCode: '1000', debit: 0, credit: amount, ...baseLineDims },
    ],
  }
}

/** Raw purchase (vendor bill) row from Supabase (snake_case). */
export interface PurchaseSource {
  id: string
  site_id: string
  status: string
  amount: number
  amount_due: number
  purchase_date: string
  currency?: string | null
  location_id?: string | null
  vendor_company_id?: string | null
  title?: string | null
  notes?: string | null
  accounting_state?: string
  vendor?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export interface PurchaseItemSource {
  catalog_item_id?: string | null
  name?: string | null
  quantity?: number | null
  unit_cost?: number | null
  subtotal?: number | null
  catalog_items?: {
    kind?: string | null
  } | null
}

/**
 * Vendor bill: DR Inventory (product lines) / Operating (rest), CR Cash + AP.
 * Posts for pending or completed (not draft/cancelled).
 */
export function buildFromPurchase(
  purchase: PurchaseSource,
  items: PurchaseItemSource[] = []
): JournalDraft | null {
  if (purchase.status === 'draft' || purchase.status === 'cancelled') {
    return null
  }

  const totalAmount = round2(Number(purchase.amount) || 0)
  if (totalAmount <= 0) return null

  const amountDue = round2(Math.max(0, Number(purchase.amount_due) || 0))
  const paidAmount = round2(Math.max(0, totalAmount - amountDue))
  const locId = purchase.location_id || null
  const companyId = purchase.vendor_company_id || null

  let inventoryDebit = 0
  for (const item of items) {
    const kind = item.catalog_items?.kind || null
    const lineTotal = round2(
      Number(item.subtotal) ||
        (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)
    )
    if (item.catalog_item_id && kind === 'product' && lineTotal > 0) {
      inventoryDebit = round2(inventoryDebit + lineTotal)
    }
  }
  if (inventoryDebit > totalAmount) inventoryDebit = totalAmount
  const operatingDebit = round2(totalAmount - inventoryDebit)

  const entry: Partial<JournalEntry> = {
    siteId: purchase.site_id,
    entryDate: purchase.purchase_date,
    memo: memoFromPurchase(purchase),
    sourceType: 'purchase',
    sourceId: purchase.id,
    idempotencyKey: `purchase:${purchase.id}`,
    currency: purchase.currency || 'USD',
    sourceHash: hashSource({
      status: purchase.status,
      amount: totalAmount,
      amount_due: amountDue,
      inventory_debit: inventoryDebit,
      operating_debit: operatingDebit,
      location_id: locId,
      vendor_company_id: companyId,
      date: purchase.purchase_date,
      item_count: items.length,
    }),
  }

  const baseLineDims = {
    locationId: locId,
    companyId,
  }

  const lines: Partial<JournalLine>[] = []
  if (inventoryDebit > 0) {
    lines.push({ accountCode: '1200', debit: inventoryDebit, credit: 0, ...baseLineDims })
  }
  if (operatingDebit > 0) {
    lines.push({ accountCode: '5600', debit: operatingDebit, credit: 0, ...baseLineDims })
  }
  if (paidAmount > 0) {
    lines.push({ accountCode: '1000', debit: 0, credit: paidAmount, ...baseLineDims })
  }
  if (amountDue > 0) {
    lines.push({ accountCode: '2200', debit: 0, credit: amountDue, ...baseLineDims })
  }

  const sumDebits = round2(lines.reduce((acc, l) => acc + (l.debit || 0), 0))
  const sumCredits = round2(lines.reduce((acc, l) => acc + (l.credit || 0), 0))
  if (Math.abs(sumDebits - sumCredits) > 0.01) {
    console.error('Unbalanced purchase entry:', sumDebits, sumCredits, purchase.id)
    return null
  }

  return { entry, lines }
}
