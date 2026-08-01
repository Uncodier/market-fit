'use server'

import { createClient } from '@/lib/supabase/server'
import { buildFromSale, buildFromExpense, JournalDraft } from './builders'
import { ensureChartOfAccounts, getAllAccounts } from './chart'
import { insertJournalEntry } from './entries'

export async function ensurePolizasForPeriod(
  siteId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  await ensureChartOfAccounts(siteId)

  const supabase = await createClient()

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*, sale_orders(*)')
    .eq('site_id', siteId)
    .gte('sale_date', fromDate)
    .lte('sale_date', toDate)

  if (salesError) {
    console.error(salesError)
    throw new Error('Failed to fetch sales')
  }

  const { data: expenses, error: expensesError } = await supabase
    .from('transactions')
    .select('*')
    .eq('site_id', siteId)
    .gte('date', fromDate)
    .lte('date', toDate)

  if (expensesError) {
    console.error(expensesError)
    throw new Error('Failed to fetch expenses')
  }

  const accounts = await getAllAccounts(siteId)
  const expenseCodeMap = new Map<string, string>()
  accounts.forEach(a => {
    if (a.type === 'expense' && a.key) {
      expenseCodeMap.set(a.key, a.code)
    }
  })

  const { data: existingEntries, error: existingError } = await supabase
    .from('journal_entries')
    .select('id, idempotency_key, source_hash')
    .eq('site_id', siteId)
    .in('source_type', ['sale', 'expense'])

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

  for (const sale of sales || []) {
    const order =
      sale.sale_orders && sale.sale_orders.length > 0 ? sale.sale_orders[0] : null
    const draft = buildFromSale(sale, order)
    const key = `sale:${sale.id}`
    const existing = existingMap.get(key)

    if (!draft) {
      if (existing) toDeleteIds.push(existing.id)
      continue
    }

    if (existing) {
      if (existing.hash === draft.entry.sourceHash) continue
      toDeleteIds.push(existing.id)
    }
    toInsert.push(draft)
  }

  for (const exp of expenses || []) {
    const code = expenseCodeMap.get(exp.category) || '5900'
    const draft = buildFromExpense(exp, code)
    const key = `expense:${exp.id}`
    const existing = existingMap.get(key)

    if (!draft) {
      if (existing) toDeleteIds.push(existing.id)
      continue
    }

    if (existing) {
      if (existing.hash === draft.entry.sourceHash) continue
      toDeleteIds.push(existing.id)
    }
    toInsert.push(draft)
  }

  // Delete first so idempotency_key unique constraint allows re-insert
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
}
