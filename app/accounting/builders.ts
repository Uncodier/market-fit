import type { JournalEntry, JournalLine } from '@/app/types'
import type { SaleSource, SaleOrderSource, ExpenseSource, PurchaseSource, PurchaseItemSource, JournalDraft } from './builder-types'
import { memoFromExpense, memoFromPurchase, memoFromSale } from './journal-memo'
import { cents, postingCurrency, postingDate, postingDraft, postingLine, singleDayDraft, sumCents } from './posting-core'
import { paymentDrafts, paymentGroups } from './posting-payments'
import { refundDrafts } from './posting-refunds'
export type { SaleSource, SaleOrderSource, ExpenseSource, PurchaseSource, PurchaseItemSource, JournalDraft } from './builder-types'

export function resolveSaleIncomeAccountCode(order: SaleOrderSource | null, codes: Map<string, string>): string {
  const keys = new Set((order?.sale_order_items || []).map(item => item.catalog_items?.catalog_categories?.income_account_key || 'revenue'))
  if (keys.size !== 1) return codes.get('revenue') || '4000'
  const key = [...keys][0]
  const code = codes.get(key)
  if (!code && key !== 'revenue') throw new Error('The selected income account is missing')
  return code || '4000'
}

export function buildSaleJournalDrafts(
  sale: SaleSource, order: SaleOrderSource | null, codes = new Map([['revenue', '4000']]),
): JournalDraft[] {
  const status = sale.status?.toLowerCase()
  if (status === 'cancelled' && !sale.refunds?.length) throw new Error('Cancelled sales require a dated correcting entry; history was preserved')
  if (status === 'refunded' && !sale.refunds?.length) throw new Error('Refunded sales require dated refund evidence')
  if (!['pending', 'completed', 'refunded', 'cancelled'].includes(status)) return []
  const total = cents(sale.amount, 'Sale amount')
  const due = cents(sale.amount_due, 'Amount due')
  const tax = cents(order?.tax_total ?? order?.taxTotal ?? 0, 'Sale tax')
  if (tax > total) throw new Error('Sale tax exceeds the total')
  const origin = postingDate(sale.sale_date)
  const currency = postingCurrency(sale.currency)
  const groups = paymentGroups(sale.payments, total, due, origin, currency)
  const income = resolveSaleIncomeAccountCode(order, codes)
  const dimensions: Partial<JournalLine> = { locationId: sale.location_id || null, leadId: sale.lead_id || null,
    campaignId: sale.campaign_id || null, segmentId: sale.segment_id || null, companyId: sale.company_id || null }
  const entry: Partial<JournalEntry> = { siteId: sale.site_id, entryDate: origin, currency, memo: memoFromSale(sale),
    sourceType: 'sale', sourceId: sale.id, idempotencyKey: `sale:${sale.id}` }
  const drafts: JournalDraft[] = []
  if (total) {
    const lines = [postingLine('1100', total, 0, dimensions)]
    if (total - tax) lines.push(postingLine(income, 0, total - tax, dimensions))
    if (tax) lines.push(postingLine('2100', 0, tax, dimensions))
    drafts.push(postingDraft(entry, lines))
  }
  drafts.push(...paymentDrafts(entry, groups, total, dimensions))
  drafts.push(...refundDrafts(entry, sale.refunds || [], groups, total, tax, income, dimensions))
  return drafts
}

/** Same-day compatibility helper. Multi-date callers must use buildSaleJournalDrafts. */
export function buildFromSale(sale: SaleSource, order: SaleOrderSource | null, codes = new Map([['revenue', '4000']])) {
  return singleDayDraft(buildSaleJournalDrafts(sale, order, codes), postingDate(sale.sale_date), 'buildSaleJournalDrafts')
}

export function resolveExpenseAccountKey(tx: ExpenseSource): string {
  const key = tx.category || 'other'
  return key === 'cogs' && tx.catalog_category?.cogs_account_key ? tx.catalog_category.cogs_account_key : key
}

export function buildFromExpense(tx: ExpenseSource, codes: Map<string, string>): JournalDraft | null {
  const amount = cents(tx.amount, 'Expense amount')
  if (amount === 0 || (tx.category === 'promotions' && tx.sale_order_id)) return null
  const key = resolveExpenseAccountKey(tx)
  const accountCode = codes.get(key) || codes.get('other') || '5900'
  const dimensions: Partial<JournalLine> = { locationId: tx.location_id || null, leadId: tx.lead_id || null,
    campaignId: tx.campaign_id || null, segmentId: tx.segment_id || null, catalogItemId: tx.catalog_item_id || null,
    catalogCategoryId: tx.catalog_category_id || null, companyId: tx.company_id || null }
  return postingDraft({ siteId: tx.site_id, entryDate: postingDate(tx.date), memo: memoFromExpense(tx),
    sourceType: 'expense', sourceId: tx.id, idempotencyKey: `expense:${tx.id}`, currency: postingCurrency(tx.currency) },
  [postingLine(accountCode, amount, 0, dimensions), postingLine('1000', 0, amount, dimensions)])
}

export function buildPurchaseJournalDrafts(purchase: PurchaseSource, items: PurchaseItemSource[] = []): JournalDraft[] {
  if (purchase.status === 'draft') return []
  if (purchase.status === 'cancelled') throw new Error('Cancelled purchases require a dated correcting entry; history was preserved')
  if (!['pending', 'completed'].includes(purchase.status)) throw new Error('Invalid purchase status')
  const total = cents(purchase.amount, 'Purchase amount')
  const due = cents(purchase.amount_due, 'Amount due')
  const origin = postingDate(purchase.purchase_date)
  const currency = postingCurrency(purchase.currency)
  const groups = paymentGroups(purchase.payments, total, due, origin, currency)
  let inventory = 0
  for (const item of items) {
    const rawSubtotal = item.subtotal ?? (Number(item.quantity ?? 0) * Number(item.unit_cost ?? 0))
    const subtotal = cents(rawSubtotal, 'Purchase line subtotal')
    if (item.catalog_item_id && item.catalog_items?.kind === 'product') inventory = sumCents([inventory, subtotal])
  }
  if (inventory > total) throw new Error('Product costs exceed the purchase total')
  const dimensions: Partial<JournalLine> = { locationId: purchase.location_id || null, companyId: purchase.vendor_company_id || null }
  const entry: Partial<JournalEntry> = { siteId: purchase.site_id, entryDate: origin, currency, memo: memoFromPurchase(purchase),
    sourceType: 'purchase', sourceId: purchase.id, idempotencyKey: `purchase:${purchase.id}` }
  const drafts: JournalDraft[] = []
  if (total) {
    const lines: Partial<JournalLine>[] = []
    if (inventory) lines.push(postingLine('1200', inventory, 0, dimensions))
    if (total - inventory) lines.push(postingLine('5600', total - inventory, 0, dimensions))
    lines.push(postingLine('2200', 0, total, dimensions))
    drafts.push(postingDraft(entry, lines))
  }
  return [...drafts, ...paymentDrafts(entry, groups, total, dimensions)]
}

export function buildFromPurchase(purchase: PurchaseSource, items: PurchaseItemSource[] = []) {
  return singleDayDraft(buildPurchaseJournalDrafts(purchase, items), postingDate(purchase.purchase_date), 'buildPurchaseJournalDrafts')
}