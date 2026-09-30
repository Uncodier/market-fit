'use server'

import { randomUUID } from 'crypto'
import { z } from 'zod'
import { requireAccountingAccess } from './access'
import { accountingDateRange } from './dates'
import { readAllAccountingRows } from './paging'
import { saveJournalWithClient } from './journal-store'
import { parseJournalPayload, type JournalPayload } from './validation'

export async function listJournalEntries(siteId: string, fromDate: string, toDate: string, sourceType?: string) {
  const supabase = await requireAccountingAccess(siteId)
  const range = accountingDateRange(fromDate, toDate)
  if (sourceType && !['all', 'sale', 'expense', 'purchase', 'opening', 'manual'].includes(sourceType)) {
    throw new Error('Invalid journal source type')
  }
  return readAllAccountingRows<any>(() => {
    let query = supabase.from('journal_entries').select('*, journal_lines(*)', { count: 'exact' })
      .eq('site_id', siteId).gte('entry_date', range.from).lt('entry_date', range.toExclusive)
      .order('entry_date', { ascending: false }).order('id', { ascending: false })
    if (sourceType && sourceType !== 'all') query = query.eq('source_type', sourceType)
    return query
  })
}

export async function getJournalEntry(siteId: string, entryId: string) {
  const supabase = await requireAccountingAccess(siteId)
  if (!supabase._isDemo) z.string().uuid().parse(entryId)
  const { data, error } = await supabase.from('journal_entries').select('*, journal_lines(*)')
    .eq('site_id', siteId).eq('id', entryId).single()
  if (error || !data) throw new Error('Journal entry not found')
  return data
}

export async function createManualJournalEntry(siteId: string, payload: JournalPayload) {
  const parsed = parseJournalPayload(payload)
  const supabase = await requireAccountingAccess(siteId, 'insert')
  return saveJournalWithClient(supabase, siteId, {
    entry: { siteId, entryDate: parsed.entryDate, memo: parsed.memo, currency: parsed.currency,
      sourceType: 'manual', sourceId: null, idempotencyKey: `manual:${randomUUID()}` },
    lines: parsed.lines,
  })
}

export async function updateManualJournalEntry(siteId: string, entryId: string, payload: JournalPayload) {
  z.string().uuid().parse(entryId)
  const parsed = parseJournalPayload(payload)
  if (parsed.expectedHash === undefined) throw new Error('Reload the journal entry before editing it')
  const supabase = await requireAccountingAccess(siteId, 'update')
  const { data: existing, error } = await supabase.from('journal_entries')
    .select('source_type, idempotency_key, currency').eq('site_id', siteId).eq('id', entryId).single()
  if (error || !existing) throw new Error('Journal entry not found')
  if (existing.source_type !== 'manual') throw new Error('Only manual journal entries can be edited')
  if (existing.currency && parsed.currency !== existing.currency) {
    throw new Error('An existing journal currency cannot be changed. Use a correcting entry.')
  }
  return saveJournalWithClient(supabase, siteId, {
    entry: { siteId, entryDate: parsed.entryDate, memo: parsed.memo, currency: parsed.currency,
      sourceType: 'manual', sourceId: null, idempotencyKey: existing.idempotency_key },
    lines: parsed.lines,
  }, { entryId, expectedHash: parsed.expectedHash, checkVersion: true })
}

export async function deleteManualJournalEntry(siteId: string, entryId: string) {
  z.string().uuid().parse(entryId)
  const supabase = await requireAccountingAccess(siteId, 'delete')
  const { error } = await supabase.rpc('accounting_delete_manual_journal', {
    p_site_id: siteId, p_entry_id: entryId,
  })
  if (error) throw new Error('Unable to delete this manual journal entry')
}