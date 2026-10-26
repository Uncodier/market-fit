import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { accountingDate, accountingDateRange } from './dates'
import { readAllAccountingRows } from './paging'
import { SYNC_BATCH_SIZE } from './sync-progress'
import { loadPostingAccountMap, postSourceJournalWithClient, sourceTables, type AccountingSourceType } from './source-posting'

export type PeriodSyncSource = { type: AccountingSourceType; id: string }
export const PERIOD_SYNC_BATCH_SIZE = SYNC_BATCH_SIZE

/** Discover under RLS, including older documents with receipts or refunds in this period. */
export async function findPeriodSyncSources(userClient: SupabaseClient, siteId: string, fromDate: string, toDate: string) {
  const range = accountingDateRange(fromDate, toDate)
  const start = range.from.slice(0, 10)
  const end = accountingDate(toDate)
  const within = (date: unknown) => typeof date === 'string' && !!date &&
    accountingDate(date) >= start && accountingDate(date) <= end
  const groups = await Promise.all((['sale', 'expense', 'purchase'] as const).map(async type => {
    const dateColumn = type === 'sale' ? 'sale_date' : type === 'purchase' ? 'purchase_date' : 'date'
    const columns = `id, ${dateColumn}, updated_at${type === 'expense' ? '' : ', payments'}`
    const rows = await readAllAccountingRows<{ id: string; payments?: { date?: string }[]; [column: string]: unknown }>(() => {
      const query = userClient.from(sourceTables[type]).select(columns, { count: 'exact' })
        .eq('site_id', siteId).neq('accounting_state', 'unpublished')
      // Expenses have no embedded receipt history; their filtering can happen in PostgreSQL.
      if (type === 'expense') query.or(`and(date.gte.${start},date.lt.${range.toExclusive.slice(0, 10)}),and(updated_at.gte.${range.from},updated_at.lt.${range.toExclusive})`)
      return query.order('id')
    })
    return rows.filter(row => within(row[dateColumn]) || within(row.updated_at) ||
      row.payments?.some((payment: { date?: string }) => within(payment.date)))
      .map(row => ({ type, id: row.id as string }))
  }))
  const sources = groups.flat()
  const seen = new Set(sources.map(source => `${source.type}:${source.id}`))
  const refunds = await readAllAccountingRows<{ sale_id: string }>(() => userClient.from('accounting_sale_refunds')
    .select('id, sale_id', { count: 'exact' }).eq('site_id', siteId)
    .gte('refunded_at', range.from).lt('refunded_at', range.toExclusive).order('id'))
  for (const refund of refunds) {
    const key = `sale:${refund.sale_id}`
    if (!seen.has(key)) {
      sources.push({ type: 'sale', id: refund.sale_id })
      seen.add(key)
    }
  }
  return sources
}

/** The caller must authorize all sources before passing a privileged client. */
export async function postPeriodSyncSources(service: SupabaseClient, siteId: string, sources: PeriodSyncSource[]) {
  if (!sources.length) return { processed: 0, failed: 0 }
  const accountCodes = await loadPostingAccountMap(service, siteId)
  let next = 0
  let failed = 0
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
    while (next < sources.length) {
      const source = sources[next++]
      try {
        await postSourceJournalWithClient(service, source.type, source.id, siteId, { skipUnpublished: true, accountCodes })
      } catch {
        failed += 1
      }
    }
  }))
  return { processed: sources.length, failed }
}