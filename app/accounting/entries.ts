'use server'

import { createClient } from '@/lib/supabase/server'
import { JournalDraft } from './builders'

export async function insertJournalEntry(draft: JournalDraft) {
  const supabase = await createClient()

  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      site_id: draft.entry.siteId,
      entry_date: draft.entry.entryDate,
      memo: draft.entry.memo,
      source_type: draft.entry.sourceType,
      source_id: draft.entry.sourceId,
      idempotency_key: draft.entry.idempotencyKey,
      source_hash: draft.entry.sourceHash,
      currency: draft.entry.currency,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    console.error('Failed to insert journal entry:', entryError)
    throw new Error('Failed to insert journal entry')
  }

  const linesToInsert = draft.lines.map(l => ({
    entry_id: entry.id,
    account_code: l.accountCode,
    debit: l.debit,
    credit: l.credit,
    location_id: l.locationId ?? null,
    lead_id: l.leadId ?? null,
    campaign_id: l.campaignId ?? null,
    segment_id: l.segmentId ?? null,
    catalog_item_id: l.catalogItemId ?? null,
    catalog_category_id: l.catalogCategoryId ?? null,
    company_id: l.companyId ?? null,
  }))

  const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert)

  if (linesError) {
    console.error('Failed to insert journal lines:', linesError)
    // Roll back orphan header
    await supabase.from('journal_entries').delete().eq('id', entry.id)
    throw new Error('Failed to insert journal lines')
  }
}

export async function listJournalEntries(
  siteId: string,
  fromDate: string,
  toDate: string,
  sourceType?: string
) {
  const supabase = await createClient()

  let query = supabase
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .eq('site_id', siteId)
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (sourceType && sourceType !== 'all') {
    query = query.eq('source_type', sourceType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch journal entries:', error)
    throw new Error('Failed to fetch journal entries')
  }

  return data
}

export async function getJournalEntry(siteId: string, entryId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .eq('site_id', siteId)
    .eq('id', entryId)
    .single()

  if (error) {
    console.error('Failed to fetch journal entry:', error)
    throw new Error('Failed to fetch journal entry')
  }

  return data
}

export async function createManualJournalEntry(
  siteId: string,
  payload: {
    entryDate: string
    memo: string
    currency: string
    lines: { accountCode: string; debit: number; credit: number }[]
  }
) {
  const uuid = crypto.randomUUID()
  const idempotencyKey = `manual:${uuid}`
  const sourceHash = JSON.stringify(payload) + idempotencyKey

  const draft: JournalDraft = {
    entry: {
      siteId,
      entryDate: payload.entryDate,
      memo: payload.memo,
      sourceType: 'manual',
      sourceId: null,
      idempotencyKey,
      sourceHash,
      currency: payload.currency,
    },
    lines: payload.lines.map(l => ({
      accountCode: l.accountCode,
      debit: l.debit,
      credit: l.credit,
    })),
  }

  await insertJournalEntry(draft)
}

export async function updateManualJournalEntry(
  siteId: string,
  entryId: string,
  payload: {
    entryDate: string
    memo: string
    currency: string
    lines: { accountCode: string; debit: number; credit: number }[]
  }
) {
  const supabase = await createClient()

  // Verify it is a manual entry
  const { data: existing, error: existingError } = await supabase
    .from('journal_entries')
    .select('id, source_type')
    .eq('site_id', siteId)
    .eq('id', entryId)
    .single()

  if (existingError || !existing) {
    throw new Error('Entry not found')
  }

  if (existing.source_type !== 'manual') {
    throw new Error('Only manual entries can be updated')
  }

  const sourceHash = JSON.stringify(payload) + entryId

  // Update header
  const { error: updateError } = await supabase
    .from('journal_entries')
    .update({
      entry_date: payload.entryDate,
      memo: payload.memo,
      currency: payload.currency,
      source_hash: sourceHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (updateError) {
    throw new Error('Failed to update journal entry')
  }

  // Replace lines
  await supabase.from('journal_lines').delete().eq('entry_id', entryId)

  if (payload.lines.length > 0) {
    const linesToInsert = payload.lines.map(l => ({
      entry_id: entryId,
      account_code: l.accountCode,
      debit: l.debit,
      credit: l.credit,
    }))

    const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert)
    if (linesError) {
      throw new Error('Failed to update journal lines')
    }
  }
}

export async function deleteManualJournalEntry(siteId: string, entryId: string) {
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('journal_entries')
    .select('id, source_type')
    .eq('site_id', siteId)
    .eq('id', entryId)
    .single()

  if (existingError || !existing) {
    throw new Error('Entry not found')
  }

  if (existing.source_type !== 'manual') {
    throw new Error('Only manual entries can be deleted')
  }

  const { error } = await supabase.from('journal_entries').delete().eq('id', entryId)

  if (error) {
    throw new Error('Failed to delete journal entry')
  }
}
