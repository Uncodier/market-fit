import 'server-only'

import { createHash } from 'crypto'
import { z } from 'zod'
import type { JournalDraft } from './builders'
import { parseJournalPayload } from './validation'

const dimensionKeys = ['location', 'lead', 'campaign', 'segment', 'catalogItem', 'catalogCategory', 'company'] as const
const snake = (key: string) => key.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`)

export function journalRecord(draft: JournalDraft) {
  const parsed = parseJournalPayload({
    entryDate: draft.entry.entryDate,
    memo: draft.entry.memo || '',
    currency: draft.entry.currency,
    lines: draft.lines,
  })
  const entry = {
    entry_date: `${parsed.entryDate}T00:00:00.000Z`,
    memo: parsed.memo,
    source_type: draft.entry.sourceType,
    source_id: draft.entry.sourceId || null,
    idempotency_key: draft.entry.idempotencyKey,
    currency: parsed.currency,
  }
  const lines = draft.lines.map((line, index) => {
    const dimensions: Record<string, string | null> = {}
    for (const key of dimensionKeys) {
      const value = line[`${key}Id`]
      dimensions[`${snake(key)}_id`] = value == null ? null : z.string().uuid().parse(value)
    }
    return { account_code: parsed.lines[index].accountCode, debit: parsed.lines[index].debit,
      credit: parsed.lines[index].credit, ...dimensions }
  })
  const source_hash = createHash('sha256').update(JSON.stringify({ entry, lines })).digest('hex')
  return { entry: { ...entry, source_hash }, lines }
}

export async function saveJournalWithClient(
  supabase: any, siteId: string, draft: JournalDraft,
  options: { entryId?: string; expectedHash?: string | null; checkVersion?: boolean } = {},
) {
  const record = journalRecord(draft)
  const { data, error } = await supabase.rpc('accounting_save_journal', {
    p_site_id: siteId, p_entry: record.entry, p_lines: record.lines,
    p_entry_id: options.entryId || null, p_expected_hash: options.expectedHash ?? null,
    p_check_version: options.checkVersion ?? false,
  })
  if (error) {
    if (error.code === '40001') throw new Error('This entry changed. Reload it before saving.')
    throw new Error('Unable to save journal entry. Verify permissions and accounting migrations.')
  }
  if (typeof data !== 'string') throw new Error('Journal save was not confirmed')
  return data
}