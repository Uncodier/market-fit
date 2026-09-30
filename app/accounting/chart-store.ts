import 'server-only'

import type { AccountingAccount } from '@/app/types'
import { DEFAULT_CHART } from './default-chart'
import { readAllAccountingRows } from './paging'

export function mapAccount(row: any): AccountingAccount {
  return { id: row.id, siteId: row.site_id, code: row.code, key: row.key, type: row.type,
    label: row.label, system: row.system, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at }
}

export async function loadAccountsWithClient(supabase: any, siteId: string): Promise<AccountingAccount[]> {
  const rows = await readAllAccountingRows<any>(() => supabase.from('accounting_accounts')
    .select('*', { count: 'exact' }).eq('site_id', siteId).order('code').order('id'))
  return rows.map(mapAccount)
}

/** Caller must authorize the site before providing a privileged client. */
export async function ensureChartWithClient(supabase: any, siteId: string) {
  const accounts = await loadAccountsWithClient(supabase, siteId)
  const byCode = new Map(accounts.map(account => [account.code, account]))
  const missing = DEFAULT_CHART.filter(account => !byCode.has(account.code))
  if (missing.length) {
    const { error } = await supabase.from('accounting_accounts').upsert(missing.map(account => ({
      site_id: siteId, code: account.code, key: account.key || null, type: account.type,
      label: account.label, system: account.system, active: true,
    })), { onConflict: 'site_id,code', ignoreDuplicates: true })
    if (error) throw new Error('Unable to initialize the chart of accounts')
  }
  for (const seed of DEFAULT_CHART) {
    const existing = byCode.get(seed.code)
    if (existing && (existing.type !== seed.type || (existing.key && seed.key && existing.key !== seed.key))) {
      throw new Error(`Account ${seed.code} conflicts with the required system account`)
    }
    if (seed.key && existing && !existing.key) {
      const { error } = await supabase.from('accounting_accounts').update({ key: seed.key })
        .eq('id', existing.id).eq('site_id', siteId).is('key', null)
      if (error) throw new Error('Unable to initialize accounting account keys')
    }
  }
}