'use server'

import { createClient } from '@/lib/supabase/server'
import { addCalendarDays, inclusiveEndWithUtcSlack } from '@/lib/costs/aggregate-costs'
import {
  buildFromSale,
  buildFromExpense,
  buildFromPurchase,
  ExpenseSource,
  JournalDraft,
} from './builders'
import { ensureChartOfAccounts, getAllAccounts } from './chart'
import { insertJournalEntry } from './entries'

const SALE_SELECT = `
  *,
  leads(name),
  sale_orders(
    tax_total,
    sale_order_items(
      catalog_item_id,
      catalog_items(
        category_id,
        catalog_categories(income_account_key)
      )
    )
  )
`

const EXPENSE_SELECT = `
  *,
  catalog_category:catalog_categories!catalog_category_id(cogs_account_key),
  catalog_item:catalog_items!catalog_item_id(
    category_id,
    catalog_categories(cogs_account_key)
  )
`

const PURCHASE_SELECT = `
  *,
  vendor:companies!vendor_company_id(name),
  purchase_items(
    catalog_item_id,
    name,
    quantity,
    unit_cost,
    subtotal,
    catalog_items(kind)
  )
`

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function mergeRowsById<T extends { id?: string }>(
  ...groups: Array<T[] | null | undefined>
): T[] {
  const byId = new Map<string, T>()
  for (const group of groups) {
    for (const row of group || []) {
      if (row?.id) byId.set(row.id, row)
    }
  }
  return Array.from(byId.values())
}

function normalizeExpenseSource(exp: any): ExpenseSource {
  const directCategory = firstRelation(exp.catalog_category)
  const item = firstRelation(exp.catalog_item)
  const itemCategory = firstRelation(item?.catalog_categories)

  const catalogCategory =
    directCategory ||
    (itemCategory ? { cogs_account_key: itemCategory.cogs_account_key } : null)

  const catalogCategoryId =
    exp.catalog_category_id || item?.category_id || null

  return {
    ...exp,
    catalog_category_id: catalogCategoryId,
    catalog_category: catalogCategory,
  }
}

function buildAccountMaps(accounts: Awaited<ReturnType<typeof getAllAccounts>>) {
  const codeMap = new Map<string, string>()
  accounts.forEach(a => {
    if (a.key) codeMap.set(a.key, a.code)
  })
  if (!codeMap.has('revenue')) codeMap.set('revenue', '4000')
  if (!codeMap.has('cogs')) codeMap.set('cogs', '5000')
  if (!codeMap.has('other')) codeMap.set('other', '5900')
  return codeMap
}

type SourceTable = 'sales' | 'transactions' | 'purchases'
type PolizaSourceType = 'sale' | 'expense' | 'purchase'

export async function tryUpsertPolizaForSale(saleId: string, siteId: string): Promise<void> {
  try {
    await upsertPolizaForSale(saleId, siteId)
  } catch (error) {
    console.error('[accounting] Failed to post sale journal entry:', error)
  }
}

export async function upsertPolizaForSale(saleId: string, siteId: string): Promise<void> {
  await ensureChartOfAccounts(siteId)
  const supabase = await createClient()

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select(SALE_SELECT)
    .eq('id', saleId)
    .single()

  if (saleError || !sale) {
    console.error('Failed to fetch sale', saleError)
    throw new Error('Failed to fetch sale')
  }

  const accounts = await getAllAccounts(siteId)
  const codeMap = buildAccountMaps(accounts)
  const order = firstRelation(sale.sale_orders)
  const draft = buildFromSale(sale, order, codeMap)

  await applyDraftToJournal(`sale:${saleId}`, draft, 'sales', saleId)
}

export async function upsertPolizaForExpense(transactionId: string, siteId: string): Promise<void> {
  await ensureChartOfAccounts(siteId)
  const supabase = await createClient()

  const { data: exp, error: expError } = await supabase
    .from('transactions')
    .select(EXPENSE_SELECT)
    .eq('id', transactionId)
    .single()

  if (expError || !exp) {
    console.error('Failed to fetch expense', expError)
    throw new Error('Failed to fetch expense')
  }

  const accounts = await getAllAccounts(siteId)
  const codeMap = buildAccountMaps(accounts)
  const draft = buildFromExpense(normalizeExpenseSource(exp), codeMap)

  await applyDraftToJournal(`expense:${transactionId}`, draft, 'transactions', transactionId)
}

export async function upsertPolizaForPurchase(purchaseId: string, siteId: string): Promise<void> {
  await ensureChartOfAccounts(siteId)
  const supabase = await createClient()

  const { data: purchase, error } = await supabase
    .from('purchases')
    .select(PURCHASE_SELECT)
    .eq('id', purchaseId)
    .eq('site_id', siteId)
    .single()

  if (error || !purchase) {
    console.error('Failed to fetch purchase', error)
    throw new Error('Failed to fetch purchase')
  }

  const items = purchase.purchase_items || []
  const draft = buildFromPurchase(purchase, items)
  await applyDraftToJournal(`purchase:${purchaseId}`, draft, 'purchases', purchaseId)
}

export async function removePolizaForSource(sourceType: PolizaSourceType, sourceId: string): Promise<void> {
  const supabase = await createClient()
  const idempotencyKey = `${sourceType}:${sourceId}`

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('idempotency_key', idempotencyKey)

  if (error) {
    console.error('Failed to delete journal entry:', error)
    throw new Error('Failed to delete journal entry')
  }

  const table: SourceTable =
    sourceType === 'sale' ? 'sales' : sourceType === 'expense' ? 'transactions' : 'purchases'
  await supabase
    .from(table)
    .update({ accounting_state: 'unpublished' })
    .eq('id', sourceId)
}

async function applyDraftToJournal(
  idempotencyKey: string,
  draft: JournalDraft | null,
  sourceTable: SourceTable,
  sourceId: string
) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id, source_hash')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (!draft) {
    if (existing) {
      await supabase.from('journal_entries').delete().eq('id', existing.id)
    }
    return
  }

  if (existing) {
    if (existing.source_hash === draft.entry.sourceHash) {
      await supabase.from(sourceTable)
        .update({ accounting_state: 'posted' })
        .eq('id', sourceId)
      return
    }
    await supabase.from('journal_entries').delete().eq('id', existing.id)
  }

  await insertJournalEntry(draft)

  await supabase.from(sourceTable)
    .update({ accounting_state: 'posted' })
    .eq('id', sourceId)
}

export async function ensurePolizasForPeriod(
  siteId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  await ensureChartOfAccounts(siteId)

  const supabase = await createClient()

  const fromSlack = addCalendarDays(fromDate, -1)
  const toInclusive = inclusiveEndWithUtcSlack(toDate)

  const { data: salesByDate, error: salesError } = await supabase
    .from('sales')
    .select(SALE_SELECT)
    .eq('site_id', siteId)
    .neq('accounting_state', 'unpublished')
    .gte('sale_date', fromSlack)
    .lte('sale_date', toInclusive)

  if (salesError) {
    console.error(salesError)
    throw new Error('Failed to fetch sales')
  }

  const { data: salesByCreated } = await supabase
    .from('sales')
    .select(SALE_SELECT)
    .eq('site_id', siteId)
    .neq('accounting_state', 'unpublished')
    .gte('created_at', `${fromSlack}T00:00:00.000Z`)
    .lte('created_at', `${toInclusive}T23:59:59.999Z`)

  const sales = mergeRowsById(salesByDate, salesByCreated)

  const { data: expenses, error: expensesError } = await supabase
    .from('transactions')
    .select(EXPENSE_SELECT)
    .eq('site_id', siteId)
    .neq('accounting_state', 'unpublished')
    .gte('date', fromSlack)
    .lte('date', toInclusive)

  if (expensesError) {
    console.error(expensesError)
    throw new Error('Failed to fetch expenses')
  }

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select(PURCHASE_SELECT)
    .eq('site_id', siteId)
    .neq('accounting_state', 'unpublished')
    .gte('purchase_date', fromDate)
    .lte('purchase_date', toDate)

  if (purchasesError) {
    console.error(purchasesError)
    throw new Error('Failed to fetch purchases')
  }

  const accounts = await getAllAccounts(siteId)
  const codeMap = buildAccountMaps(accounts)

  const { data: existingEntries, error: existingError } = await supabase
    .from('journal_entries')
    .select('id, idempotency_key, source_hash')
    .eq('site_id', siteId)
    .in('source_type', ['sale', 'expense', 'purchase'])

  if (existingError) {
    console.error(existingError)
    throw new Error('Failed to fetch journal entries')
  }

  const existingMap = new Map<string, { id: string; hash: string | null }>()
  ;(existingEntries || []).forEach((e: { idempotency_key: string; id: string; source_hash: string | null }) => {
    existingMap.set(e.idempotency_key, { id: e.id, hash: e.source_hash })
  })

  const toDeleteIds: string[] = []
  const toInsert: JournalDraft[] = []
  const sourcesToMarkPosted: { table: SourceTable; id: string }[] = []

  for (const sale of sales || []) {
    const order = firstRelation(sale.sale_orders)
    const draft = buildFromSale(sale, order, codeMap)
    const key = `sale:${sale.id}`
    const existing = existingMap.get(key)

    if (!draft) {
      if (existing) toDeleteIds.push(existing.id)
      continue
    }

    if (existing) {
      if (existing.hash === draft.entry.sourceHash) {
        if (sale.accounting_state !== 'posted') {
          sourcesToMarkPosted.push({ table: 'sales', id: sale.id })
        }
        continue
      }
      toDeleteIds.push(existing.id)
    }
    toInsert.push(draft)
    sourcesToMarkPosted.push({ table: 'sales', id: sale.id })
  }

  for (const exp of expenses || []) {
    const draft = buildFromExpense(normalizeExpenseSource(exp), codeMap)
    const key = `expense:${exp.id}`
    const existing = existingMap.get(key)

    if (!draft) {
      if (existing) toDeleteIds.push(existing.id)
      continue
    }

    if (existing) {
      if (existing.hash === draft.entry.sourceHash) {
        if (exp.accounting_state !== 'posted') {
          sourcesToMarkPosted.push({ table: 'transactions', id: exp.id })
        }
        continue
      }
      toDeleteIds.push(existing.id)
    }
    toInsert.push(draft)
    sourcesToMarkPosted.push({ table: 'transactions', id: exp.id })
  }

  for (const purchase of purchases || []) {
    const draft = buildFromPurchase(purchase, purchase.purchase_items || [])
    const key = `purchase:${purchase.id}`
    const existing = existingMap.get(key)

    if (!draft) {
      if (existing) toDeleteIds.push(existing.id)
      continue
    }

    if (existing) {
      if (existing.hash === draft.entry.sourceHash) {
        if (purchase.accounting_state !== 'posted') {
          sourcesToMarkPosted.push({ table: 'purchases', id: purchase.id })
        }
        continue
      }
      toDeleteIds.push(existing.id)
    }
    toInsert.push(draft)
    sourcesToMarkPosted.push({ table: 'purchases', id: purchase.id })
  }

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('journal_entries')
      .delete()
      .in('id', toDeleteIds)

    if (deleteError) {
      console.error('Failed to delete stale entries:', deleteError)
      throw new Error('Failed to delete stale journal entries')
    }
  }

  for (const draft of toInsert) {
    await insertJournalEntry(draft)
  }

  const salesToPost = sourcesToMarkPosted.filter(s => s.table === 'sales').map(s => s.id)
  const txsToPost = sourcesToMarkPosted.filter(s => s.table === 'transactions').map(s => s.id)
  const purchasesToPost = sourcesToMarkPosted.filter(s => s.table === 'purchases').map(s => s.id)

  if (salesToPost.length > 0) {
    await supabase.from('sales').update({ accounting_state: 'posted' }).in('id', salesToPost)
  }
  if (txsToPost.length > 0) {
    await supabase.from('transactions').update({ accounting_state: 'posted' }).in('id', txsToPost)
  }
  if (purchasesToPost.length > 0) {
    await supabase.from('purchases').update({ accounting_state: 'posted' }).in('id', purchasesToPost)
  }
}
