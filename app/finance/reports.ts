'use server'

import { requireAccountingAccess } from '@/app/accounting/access'
import { readAllAccountingRows } from '@/app/accounting/paging'
import { accountingDateRange } from '@/app/accounting/dates'
import { reportCurrency } from './report-currency'
import type { ReportAmounts } from './report-types'
import { INVALID_JOURNAL_MESSAGE, UNKNOWN_CURRENCY_MESSAGE } from './report-errors'

type ReportLine = { account_code: string; debit: number | string; credit: number | string }

async function resolveCurrency(supabase: any, siteId: string, requested?: string) {
  if (requested !== undefined) {
    const currency = reportCurrency(requested)
    if (!currency) throw new Error('Select a valid report currency')
    return currency
  }
  const { data, error } = await supabase.from('settings').select('currency')
    .eq('site_id', siteId).maybeSingle()
  if (error) throw new Error('Could not load the site accounting currency')
  const currency = reportCurrency(data?.currency)
  if (!currency) throw new Error('Select a report currency or configure the site currency')
  return currency
}

function aggregate(lines: ReportLine[]): ReportAmounts {
  const amounts = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const debit = Number(line.debit)
    const credit = Number(line.credit)
    if (!line.account_code || line.debit == null || line.credit == null ||
      !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      throw new Error('The report contains invalid journal amounts')
    }
    const previous = amounts.get(line.account_code) ?? { debit: 0, credit: 0 }
    const debitCents = Math.round(debit * 100)
    const creditCents = Math.round(credit * 100)
    if (Math.abs(debitCents - debit * 100) > 0.0001 || Math.abs(creditCents - credit * 100) > 0.0001) {
      throw new Error('The report contains fractional-cent journal amounts requiring review')
    }
    const total = { debit: previous.debit + debitCents, credit: previous.credit + creditCents }
    if (!Number.isSafeInteger(total.debit) || !Number.isSafeInteger(total.credit)) {
      throw new Error('The report totals exceed supported amounts')
    }
    amounts.set(line.account_code, total)
  }
  return Object.fromEntries([...amounts].map(([code, amount]) => [code, { debit: amount.debit / 100, credit: amount.credit / 100 }]))
}

const REPORT_SELECT = 'id, account_code, debit, credit, journal_entries!inner(entry_date, source_type, site_id, currency)'

async function snapshot(supabase: any, siteId: string, from: string | null, to: string, currency: string, includeOpening: boolean) {
  const { data, error } = await supabase.rpc('accounting_report_snapshot', {
    p_site_id: siteId, p_from: from, p_to_exclusive: to, p_currency: currency, p_include_opening: includeOpening,
  })
  if (error?.message === 'ACCOUNTING_UNKNOWN_CURRENCY') throw new Error(UNKNOWN_CURRENCY_MESSAGE)
  if (error?.message === 'ACCOUNTING_INVALID_JOURNAL') throw new Error(INVALID_JOURNAL_MESSAGE)
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unable to load a consistent accounting report')
  return aggregate(Object.entries(data).map(([account_code, amount]) => ({ account_code, ...(amount as { debit: number; credit: number }) })))
}

export async function getPnLReport(siteId: string, fromDate: string, toDate: string, currency?: string): Promise<ReportAmounts> {
  const supabase = await requireAccountingAccess(siteId, 'select')
  const period = accountingDateRange(fromDate, toDate)
  const selectedCurrency = await resolveCurrency(supabase, siteId, currency)
  if (!supabase._isDemo) return snapshot(supabase, siteId, period.from, period.toExclusive, selectedCurrency, false)
  // Accounting dates are UTC days. TIMESTAMPTZ ranges include the entire final day.
  const lines = await readAllAccountingRows<ReportLine>(() => supabase.from('journal_lines')
    .select(REPORT_SELECT, { count: 'exact' })
    .eq('journal_entries.site_id', siteId)
    .eq('journal_entries.currency', selectedCurrency)
    .gte('journal_entries.entry_date', period.from)
    .lt('journal_entries.entry_date', period.toExclusive)
    .neq('journal_entries.source_type', 'opening')
    .order('id', { ascending: true }))
  return aggregate(lines)
}

export async function getBalanceSheetReport(siteId: string, asOfDate: string, currency?: string): Promise<ReportAmounts> {
  const supabase = await requireAccountingAccess(siteId, 'select')
  const period = accountingDateRange(asOfDate, asOfDate)
  const selectedCurrency = await resolveCurrency(supabase, siteId, currency)
  if (!supabase._isDemo) return snapshot(supabase, siteId, null, period.toExclusive, selectedCurrency, true)
  // Opening entries are included, but never entries denominated in another currency.
  const lines = await readAllAccountingRows<ReportLine>(() => supabase.from('journal_lines')
    .select(REPORT_SELECT, { count: 'exact' })
    .eq('journal_entries.site_id', siteId)
    .eq('journal_entries.currency', selectedCurrency)
    .lt('journal_entries.entry_date', period.toExclusive)
    .order('id', { ascending: true }))
  return aggregate(lines)
}
