'use server'

import { createClient } from '@/lib/supabase/server'

export async function getPnLReport(siteId: string, fromDate: string, toDate: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      journal_entries!inner(entry_date, source_type, site_id)
    `)
    .eq('journal_entries.site_id', siteId)
    .gte('journal_entries.entry_date', fromDate)
    .lte('journal_entries.entry_date', toDate)
    .neq('journal_entries.source_type', 'opening')

  if (error) {
    console.error('Error fetching P&L data:', error)
    return {}
  }

  const aggregates: Record<string, { debit: number; credit: number }> = {}

  for (const line of data || []) {
    if (!aggregates[line.account_code]) {
      aggregates[line.account_code] = { debit: 0, credit: 0 }
    }
    aggregates[line.account_code].debit += Number(line.debit) || 0
    aggregates[line.account_code].credit += Number(line.credit) || 0
  }

  return aggregates
}

export async function getBalanceSheetReport(siteId: string, asOfDate: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      journal_entries!inner(entry_date, site_id)
    `)
    .eq('journal_entries.site_id', siteId)
    .lte('journal_entries.entry_date', asOfDate)

  if (error) {
    console.error('Error fetching Balance Sheet data:', error)
    return {}
  }

  const aggregates: Record<string, { debit: number; credit: number }> = {}

  for (const line of data || []) {
    if (!aggregates[line.account_code]) {
      aggregates[line.account_code] = { debit: 0, credit: 0 }
    }
    aggregates[line.account_code].debit += Number(line.debit) || 0
    aggregates[line.account_code].credit += Number(line.credit) || 0
  }

  return aggregates
}
