'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { AccountingAccount, AccountType } from '@/app/types'
import { requireAccountingAccess } from './access'
import { ensureChartWithClient, loadAccountsWithClient, mapAccount } from './chart-store'
import { DEFAULT_CHART } from './default-chart'
import { saveJournalWithClient } from './journal-store'
import { accountCodeSchema, accountTypeSchema, amountSchema, currencySchema } from './validation'
import { accountingDate } from './dates'

export async function ensureChartOfAccounts(siteId: string): Promise<void> {
  const reader = await requireAccountingAccess(siteId)
  if (reader._isDemo) return
  const accounts = await loadAccountsWithClient(reader, siteId)
  if (DEFAULT_CHART.every(seed => accounts.some(account => account.code === seed.code && (!seed.key || account.key)))) return
  await requireAccountingAccess(siteId, 'insert')
  await ensureChartWithClient(await createServiceClient(true), siteId)
}

export async function getAllAccounts(siteId: string): Promise<AccountingAccount[]> {
  return loadAccountsWithClient(await requireAccountingAccess(siteId), siteId)
}

export async function getActiveExpenseAccounts(siteId: string): Promise<AccountingAccount[]> {
  await ensureChartOfAccounts(siteId)
  return (await getAllAccounts(siteId)).filter(account => account.type === 'expense' && account.active)
}

export async function addAccountingAccount(siteId: string, label: string, key: string, code: string, type: AccountType) {
  const account = z.object({ label: z.string().trim().min(1).max(200), key: z.string().trim()
    .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), code: accountCodeSchema, type: accountTypeSchema }).parse({ label, key, code, type })
  const supabase = await requireAccountingAccess(siteId, 'insert')
  await ensureChartWithClient(await createServiceClient(true), siteId)
  const { data, error } = await supabase.from('accounting_accounts').insert({
    site_id: siteId, ...account, system: false, active: true,
  }).select('*').single()
  if (error || !data) throw new Error(error?.code === '23505' ? 'Account code or key already exists' : 'Unable to create account')
  return mapAccount(data)
}

export async function addExpenseAccount(siteId: string, label: string, key: string, code: string) {
  return addAccountingAccount(siteId, label, key, code, 'expense')
}

export async function updateAccountLabel(siteId: string, id: string, label: string): Promise<boolean> {
  z.string().uuid().parse(id)
  const name = z.string().trim().min(1).max(200).parse(label)
  const supabase = await requireAccountingAccess(siteId, 'update')
  const { data, error } = await supabase.from('accounting_accounts')
    .update({ label: name, updated_at: new Date().toISOString() }).eq('id', id).eq('site_id', siteId).select('id').single()
  if (error || !data) throw new Error('Unable to update account')
  return true
}

export async function toggleAccountActive(siteId: string, id: string, active: boolean): Promise<boolean> {
  z.string().uuid().parse(id)
  z.boolean().parse(active)
  const supabase = await requireAccountingAccess(siteId, 'update')
  const { data, error } = await supabase.from('accounting_accounts')
    .update({ active, updated_at: new Date().toISOString() }).eq('id', id).eq('site_id', siteId)
    .eq('system', false).select('id').single()
  if (error || !data) throw new Error('Unable to change account status. System accounts must remain active.')
  return true
}

export async function getOpeningEntry(siteId: string) {
  const supabase = await requireAccountingAccess(siteId)
  const { data, error } = await supabase.from('journal_entries').select('*, journal_lines(*)')
    .eq('site_id', siteId).eq('idempotency_key', `opening:${siteId}`).maybeSingle()
  if (error) throw new Error('Unable to load opening balances')
  return data
}

export async function saveOpeningEntry(
  siteId: string, asOfDate: string, balances: Record<string, { debit: number; credit: number }>,
  currency?: string, expectedHash?: string | null,
) {
  const entryDate = accountingDate(asOfDate)
  if (expectedHash === undefined) throw new Error('Load opening balances before saving')
  const parsed = z.record(accountCodeSchema, z.object({ debit: amountSchema, credit: amountSchema })).parse(balances)
  const supabase = await requireAccountingAccess(siteId, 'update')
  const { data: existing, error } = await supabase.from('journal_entries')
    .select('id, currency, source_hash').eq('site_id', siteId).eq('idempotency_key', `opening:${siteId}`).maybeSingle()
  if (error) throw new Error('Unable to load existing opening balances')
  if ((existing?.source_hash ?? null) !== expectedHash) throw new Error('Opening balances changed. Reload before saving.')
  let resolvedCurrency = existing?.currency || currency
  if (existing?.currency && currency && existing.currency !== currency) throw new Error('Opening balance currency cannot be changed')
  if (!resolvedCurrency) {
    const { data: settings, error: settingsError } = await supabase.from('settings')
      .select('currency').eq('site_id', siteId).maybeSingle()
    if (settingsError || !settings?.currency) throw new Error('Configure an accounting currency first')
    resolvedCurrency = settings.currency
  }
  const lines = Object.entries(parsed).filter(([code, amount]) => code !== '3000' && (amount.debit > 0 || amount.credit > 0))
    .map(([accountCode, amount]) => ({ accountCode, ...amount }))
  const balance = lines.reduce((sum, line) => sum + Math.round(line.debit * 100) - Math.round(line.credit * 100), 0)
  if (balance !== 0) lines.push({ accountCode: '3000', debit: Math.max(0, -balance) / 100, credit: Math.max(0, balance) / 100 })
  return saveJournalWithClient(supabase, siteId, {
    entry: { siteId, entryDate, currency: currencySchema.parse(resolvedCurrency), memo: 'Opening balances',
      sourceType: 'opening', sourceId: null, idempotencyKey: `opening:${siteId}` }, lines,
  }, { entryId: existing?.id, expectedHash, checkVersion: true })
}