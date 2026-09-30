'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAccountingAccess } from './access'
import { accountingDate, accountingDateRange } from './dates'
import { readAllAccountingRows } from './paging'
import { postSourceJournalWithClient, replaceSourceJournals, sourceTables, type AccountingSourceType } from './source-posting'

async function authorizedSource(type: AccountingSourceType, sourceId: string, siteId: string, command: 'update' | 'delete') {
  z.string().uuid().parse(sourceId)
  const supabase = await requireAccountingAccess(siteId, command)
  const { data, error } = await supabase.from(sourceTables[type]).select('id, site_id, updated_at, accounting_state')
    .eq('site_id', siteId).eq('id', sourceId).single()
  if (error || !data) throw new Error('Accounting source not found in this site')
  return { supabase, source: data }
}

async function post(type: AccountingSourceType, sourceId: string, siteId: string) {
  const { source } = await authorizedSource(type, sourceId, siteId, 'update')
  if (source.accounting_state === 'unpublished') {
    // Restoring a deliberately removed posting requires the same elevated permission.
    await requireAccountingAccess(siteId, 'delete')
  }
  // Role and resource ownership have been checked with the user-scoped client.
  const service = await createServiceClient(true)
  return postSourceJournalWithClient(service, type, sourceId, siteId)
}

export async function upsertPolizaForSale(saleId: string, siteId: string): Promise<void> {
  return post('sale', saleId, siteId)
}

export async function tryUpsertPolizaForSale(saleId: string, siteId: string): Promise<void> {
  try {
    const { source } = await authorizedSource('sale', saleId, siteId, 'update')
    if (source.accounting_state === 'unpublished') return
    await post('sale', saleId, siteId)
  } catch {
    // A sale may succeed while posting requires repair; never leave it falsely posted.
    const { supabase } = await authorizedSource('sale', saleId, siteId, 'update')
    const { error } = await supabase.from('sales').update({ accounting_state: 'pending', updated_at: new Date().toISOString() })
      .eq('id', saleId).eq('site_id', siteId).neq('accounting_state', 'unpublished')
    if (error) throw new Error('The sale was saved, but its accounting status could not be updated')
    console.error('[accounting] Sale posting failed; the sale remains pending accounting review')
  }
}

export async function upsertPolizaForExpense(transactionId: string, siteId: string): Promise<void> {
  return post('expense', transactionId, siteId)
}

export async function upsertPolizaForPurchase(purchaseId: string, siteId: string): Promise<void> {
  return post('purchase', purchaseId, siteId)
}

export async function removePolizaForSource(type: AccountingSourceType, sourceId: string, siteId?: string): Promise<void> {
  if (!['sale', 'expense', 'purchase'].includes(type)) throw new Error('Invalid accounting source')
  z.string().uuid().parse(sourceId)
  // Legacy callers omit siteId. Resolve ownership only with the authenticated RLS client.
  if (!siteId) {
    const { createClient } = await import('@/lib/supabase/server')
    const reader = await createClient(true)
    const { data: { user }, error: authError } = await reader.auth.getUser()
    if (authError || !user) throw new Error('Authentication required')
    const { data, error } = await reader.from(sourceTables[type]).select('site_id').eq('id', sourceId).single()
    if (error || !data) throw new Error('Accounting source not found')
    siteId = data.site_id as string
  }
  const { source } = await authorizedSource(type, sourceId, siteId, 'delete')
  const service = await createServiceClient(true)
  await replaceSourceJournals(service, siteId, type, sourceId, source.updated_at, [], 'unpublished')
}

export async function ensurePolizasForPeriod(siteId: string, fromDate: string, toDate: string): Promise<void> {
  const userClient = await requireAccountingAccess(siteId, 'update')
  const range = accountingDateRange(fromDate, toDate)
  const start = range.from.slice(0, 10)
  const end = accountingDate(toDate)
  const within = (date: unknown) => {
    if (typeof date !== 'string' || !date) return false
    const day = accountingDate(date)
    return day >= start && day <= end
  }
  const sources: { type: AccountingSourceType; id: string }[] = []
  for (const type of ['sale', 'expense', 'purchase'] as const) {
    const dateColumn = type === 'sale' ? 'sale_date' : type === 'purchase' ? 'purchase_date' : 'date'
    const columns = `id, ${dateColumn}, updated_at, accounting_state${type === 'expense' ? '' : ', payments'}`
    const rows = await readAllAccountingRows<any>(() => userClient.from(sourceTables[type])
      .select(columns, { count: 'exact' }).eq('site_id', siteId).neq('accounting_state', 'unpublished').order('id'))
    for (const row of rows) {
      if (within(row[dateColumn]) || within(row.updated_at) || row.payments?.some((payment: any) => within(payment.date))) {
        sources.push({ type, id: row.id })
      }
    }
  }
  const refunds = await readAllAccountingRows<{ sale_id: string }>(() => userClient.from('accounting_sale_refunds')
    .select('id, sale_id', { count: 'exact' }).eq('site_id', siteId)
    .gte('refunded_at', range.from).lt('refunded_at', range.toExclusive).order('id'))
  for (const refund of refunds) {
    if (!sources.some(source => source.type === 'sale' && source.id === refund.sale_id)) sources.push({ type: 'sale', id: refund.sale_id })
  }
  // Every candidate came from authenticated, site-scoped reads. Each source is replaced atomically.
  const service = await createServiceClient(true)
  let failed = 0
  for (const source of sources) {
    try {
      await postSourceJournalWithClient(service, source.type, source.id, siteId, { skipUnpublished: true })
    } catch {
      failed += 1
    }
  }
  if (failed) throw new Error(`${failed} of ${sources.length} sources could not be synchronized. Existing entries were preserved; review source data and retry.`)
}