'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAccountingAccess } from './access'
import { findPeriodSyncSources, postPeriodSyncSources, PERIOD_SYNC_BATCH_SIZE } from './period-sync'
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
  const sources = await findPeriodSyncSources(userClient, siteId, fromDate, toDate)
  // Every candidate came from authenticated, site-scoped reads. Each source is replaced atomically.
  const service = await createServiceClient(true)
  const { failed } = await postPeriodSyncSources(service, siteId, sources)
  if (failed) throw new Error(`${failed} of ${sources.length} sources could not be synchronized. Existing entries were preserved; review source data and retry.`)
}

export async function preparePeriodSync(siteId: string, fromDate: string, toDate: string) {
  const userClient = await requireAccountingAccess(siteId, 'update')
  return findPeriodSyncSources(userClient, siteId, fromDate, toDate)
}

export async function syncPeriodBatch(siteId: string, input: unknown) {
  const sources = z.array(z.object({ type: z.enum(['sale', 'expense', 'purchase']), id: z.string().uuid() }))
    .min(1).max(PERIOD_SYNC_BATCH_SIZE).parse(input)
  const unique = new Set(sources.map(source => `${source.type}:${source.id}`))
  if (unique.size !== sources.length) throw new Error('Duplicate accounting sources')
  const userClient = await requireAccountingAccess(siteId, 'update')
  // Browser-provided source IDs are untrusted. Verify every ID under RLS before elevation.
  await Promise.all((['sale', 'expense', 'purchase'] as const).map(async type => {
    const ids = sources.filter(source => source.type === type).map(source => source.id)
    if (!ids.length) return
    const { data, error } = await userClient.from(sourceTables[type]).select('id')
      .eq('site_id', siteId).in('id', ids)
    if (error || !data || data.length !== ids.length) throw new Error('Accounting source not found in this site')
  }))
  const service = await createServiceClient(true)
  return postPeriodSyncSources(service, siteId, sources)
}