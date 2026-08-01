'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_CHART } from './default-chart'
import { AccountingAccount } from '../types'

function mapAccount(row: any): AccountingAccount {
  return {
    id: row.id,
    siteId: row.site_id,
    code: row.code,
    key: row.key,
    type: row.type,
    label: row.label,
    system: row.system,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureChartOfAccounts(siteId: string): Promise<void> {
  const supabase = await createClient()

  const { data: existingAccounts, error: existingError } = await supabase
    .from('accounting_accounts')
    .select('code')
    .eq('site_id', siteId)

  if (existingError) {
    console.error('Error fetching existing accounts:', existingError)
    throw new Error(`Could not fetch existing accounts: ${existingError.message}`)
  }

  const existingCodes = new Set((existingAccounts || []).map((a: { code: string }) => a.code))
  const missingAccounts = DEFAULT_CHART.filter(a => !existingCodes.has(a.code))

  if (missingAccounts.length > 0) {
    const toInsert = missingAccounts.map(a => ({
      site_id: siteId,
      code: a.code,
      key: a.key || null,
      type: a.type,
      label: a.label,
      system: a.system,
      active: true,
    }))

    const { error: insertError } = await supabase
      .from('accounting_accounts')
      .insert(toInsert)

    if (insertError) {
      console.error('Error seeding chart of accounts:', insertError)
      throw new Error('Could not seed chart of accounts')
    }
  }
}

export async function getAllAccounts(siteId: string): Promise<AccountingAccount[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('site_id', siteId)
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching all accounts:', error)
    return []
  }

  return (data || []).map(mapAccount)
}

export async function getActiveExpenseAccounts(siteId: string): Promise<AccountingAccount[]> {
  await ensureChartOfAccounts(siteId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('site_id', siteId)
    .eq('type', 'expense')
    .eq('active', true)
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching active expense accounts:', error)
    return []
  }

  return (data || []).map(mapAccount)
}

export async function addExpenseAccount(
  siteId: string,
  label: string,
  key: string,
  code: string
): Promise<AccountingAccount | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounting_accounts')
    .insert({
      site_id: siteId,
      code,
      key,
      type: 'expense',
      label,
      system: false,
      active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding expense account:', error)
    return null
  }

  return mapAccount(data)
}

export async function updateAccountLabel(siteId: string, id: string, label: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('accounting_accounts')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) {
    console.error('Error updating account label:', error)
    return false
  }
  return true
}

export async function toggleAccountActive(siteId: string, id: string, active: boolean): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('accounting_accounts')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('system', false)

  if (error) {
    console.error('Error toggling account active state:', error)
    return false
  }
  return true
}

export async function getOpeningEntry(siteId: string) {
  const supabase = await createClient()
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .eq('site_id', siteId)
    .eq('idempotency_key', `opening:${siteId}`)
    .maybeSingle()

  return entry
}

export async function saveOpeningEntry(
  siteId: string,
  asOfDate: string,
  balances: Record<string, { debit: number; credit: number }>
) {
  const supabase = await createClient()

  let totalDebit = 0
  let totalCredit = 0

  for (const [code, amts] of Object.entries(balances)) {
    if (code !== '3000') {
      totalDebit += Number(amts.debit) || 0
      totalCredit += Number(amts.credit) || 0
    }
  }

  const plugCredit = Math.max(0, totalDebit - totalCredit)
  const plugDebit = Math.max(0, totalCredit - totalDebit)

  const finalBalances = { ...balances }
  finalBalances['3000'] = { debit: plugDebit, credit: plugCredit }

  const sourceHash = JSON.stringify(finalBalances) + asOfDate

  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('site_id', siteId)
    .eq('idempotency_key', `opening:${siteId}`)
    .maybeSingle()

  const linesPayload = Object.entries(finalBalances)
    .filter(([, amts]) => (amts.debit || 0) > 0 || (amts.credit || 0) > 0)
    .map(([code, amts]) => ({
      account_code: code,
      debit: amts.debit || 0,
      credit: amts.credit || 0,
    }))

  if (existing) {
    await supabase.from('journal_lines').delete().eq('entry_id', existing.id)

    const { error: updateError } = await supabase
      .from('journal_entries')
      .update({
        entry_date: asOfDate,
        source_hash: sourceHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) throw new Error('Failed to update opening entry')

    if (linesPayload.length > 0) {
      const { error: linesError } = await supabase.from('journal_lines').insert(
        linesPayload.map(line => ({ ...line, entry_id: existing.id }))
      )
      if (linesError) throw new Error('Failed to save opening lines')
    }
  } else {
    const { data: newEntry, error } = await supabase
      .from('journal_entries')
      .insert({
        site_id: siteId,
        entry_date: asOfDate,
        memo: 'Opening balances',
        source_type: 'opening',
        idempotency_key: `opening:${siteId}`,
        source_hash: sourceHash,
      })
      .select('id')
      .single()

    if (error || !newEntry) throw new Error('Failed to create opening entry')

    if (linesPayload.length > 0) {
      const { error: linesError } = await supabase.from('journal_lines').insert(
        linesPayload.map(line => ({ ...line, entry_id: newEntry.id }))
      )
      if (linesError) throw new Error('Failed to save opening lines')
    }
  }
}
