import 'server-only'

import { z } from 'zod'
import { buildFromExpense, buildSaleJournalDrafts, buildPurchaseJournalDrafts, type JournalDraft } from './builders'
import { ensureChartWithClient, loadAccountsWithClient } from './chart-store'
import { journalRecord } from './journal-store'
import { readAllAccountingRows } from './paging'

export type AccountingSourceType = 'sale' | 'expense' | 'purchase'
export const sourceTables = { sale: 'sales', expense: 'transactions', purchase: 'purchases' } as const

const saleSelect = `*, leads(name), sale_orders(tax_total,
  sale_order_items(catalog_item_id, catalog_items(category_id, catalog_categories(income_account_key))))`
const expenseSelect = `*, catalog_category:catalog_categories!catalog_category_id(cogs_account_key),
  catalog_item:catalog_items!catalog_item_id(category_id, catalog_categories(cogs_account_key))`
const purchaseSelect = `*, vendor:companies!vendor_company_id(name),
  purchase_items(catalog_item_id, name, quantity, unit_cost, subtotal, catalog_items(kind))`
const selects = { sale: saleSelect, expense: expenseSelect, purchase: purchaseSelect }
const first = (value: any) => Array.isArray(value) ? value[0] : value

async function accountMap(supabase: any, siteId: string) {
  await ensureChartWithClient(supabase, siteId)
  const accounts = await loadAccountsWithClient(supabase, siteId)
  const map = new Map<string, string>()
  for (const account of accounts) {
    if (!account.key) continue
    if (map.has(account.key)) throw new Error('Duplicate accounting account keys require review')
    map.set(account.key, account.code)
  }
  return map
}

/** Only call with a service client after authorizing the exact source and site. */
export async function postSourceJournalWithClient(
  supabase: any, type: AccountingSourceType, sourceId: string, siteId: string,
  options: { skipUnpublished?: boolean } = {},
) {
  z.string().uuid().parse(siteId)
  z.string().uuid().parse(sourceId)
  const { data: source, error } = await supabase.from(sourceTables[type]).select(selects[type])
    .eq('id', sourceId).eq('site_id', siteId).single()
  if (error || !source) throw new Error('Unable to load the accounting source')
  if (options.skipUnpublished && source.accounting_state === 'unpublished') return
  if (type === 'purchase' && source.status === 'draft') {
    const { data: existing, error: lookupError } = await supabase.from('journal_entries').select('id')
      .eq('site_id', siteId).eq('source_type', type).eq('source_id', sourceId).limit(1)
    if (lookupError || existing?.length) throw new Error('Draft status cannot remove an existing purchase journal')
  }
  const codes = await accountMap(supabase, siteId)
  let drafts: JournalDraft[]
  if (type === 'sale') {
    const refunds = await readAllAccountingRows<any>(() => supabase.from('accounting_sale_refunds')
      .select('id, amount, currency, refunded_at', { count: 'exact' }).eq('sale_id', sourceId)
      .eq('site_id', siteId).order('id'))
    drafts = buildSaleJournalDrafts({ ...source, refunds }, first(source.sale_orders) || null, codes)
  } else if (type === 'purchase') {
    drafts = buildPurchaseJournalDrafts(source, source.purchase_items || [])
  } else {
    const item = first(source.catalog_item)
    const draft = buildFromExpense({ ...source,
      catalog_category_id: source.catalog_category_id || item?.category_id || null,
      catalog_category: first(source.catalog_category) || first(item?.catalog_categories) || null,
    }, codes)
    drafts = draft ? [draft] : []
  }
  await replaceSourceJournals(supabase, siteId, type, sourceId, source.updated_at, drafts, 'posted')
}

export async function postSaleJournalWithClient(supabase: any, saleId: string, siteId: string) {
  return postSourceJournalWithClient(supabase, 'sale', saleId, siteId, { skipUnpublished: true })
}

/** Best-effort follow-up only for an already authorized, persisted checkout. */
export async function tryPostSaleJournalWithClient(supabase: any, saleId: string, siteId: string) {
  try {
    await postSaleJournalWithClient(supabase, saleId, siteId)
  } catch {
    const { error } = await supabase.from('sales')
      .update({ accounting_state: 'pending', updated_at: new Date().toISOString() })
      .eq('site_id', siteId).eq('id', saleId).neq('accounting_state', 'unpublished')
    if (error) throw new Error('Checkout succeeded, but its accounting status could not be saved')
    console.error('[accounting] Checkout posting requires review; the sale remains pending')
  }
}

export async function replaceSourceJournals(
  supabase: any, siteId: string, type: AccountingSourceType, sourceId: string,
  updatedAt: string, drafts: JournalDraft[], state: 'posted' | 'unpublished',
) {
  if (!updatedAt) throw new Error('Accounting source version is missing')
  const { error } = await supabase.rpc('accounting_replace_source_journals', {
    p_site_id: siteId, p_source_type: type, p_source_id: sourceId,
    p_source_updated_at: updatedAt, p_entries: drafts.map(journalRecord), p_state: state,
  })
  if (error?.code === '40001') throw new Error('The source changed while posting. Please retry.')
  if (error) throw new Error('Unable to post journal entries. Verify the source, account status, and accounting migrations.')
}