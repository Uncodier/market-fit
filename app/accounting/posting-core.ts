import { createHash } from 'crypto'
import type { JournalEntry, JournalLine } from '../types'
import type { JournalDraft } from './builder-types'
import { accountingDate } from './dates'
import { amountSchema, currencySchema, parseJournalPayload } from './validation'

/** Money is calculated as integer cents; malformed sources must not erase journals. */
export function cents(value: unknown, label: string): number {
  const numeric = typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())
    ? Number(value) : value
  const parsed = amountSchema.safeParse(numeric)
  if (!parsed.success) throw new Error(`${label} must be finite, nonnegative money with at most two decimal places`)
  return Math.round(parsed.data * 100)
}

export function sumCents(values: number[]): number {
  const sum = values.reduce((total, value) => total + value, 0)
  if (!Number.isSafeInteger(sum)) throw new Error('Accounting amount exceeds safe precision')
  return sum
}

export function postingCurrency(value: string | null | undefined): string {
  return currencySchema.parse(value ?? 'USD')
}

/** Legacy timestamps without an offset are interpreted as UTC, never machine-local time. */
export function postingDate(value: string): string {
  if (typeof value !== 'string') throw new Error('A valid accounting date is required')
  const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
  if (value.length !== 10 && !timestamp) throw new Error('A valid accounting timestamp is required')
  return accountingDate(timestamp && !timestamp[1] ? `${value}Z` : value)
}

export function postingLine(
  accountCode: string, debit: number, credit: number, dimensions: Partial<JournalLine>,
): Partial<JournalLine> {
  return { ...dimensions, accountCode, debit: debit / 100, credit: credit / 100 }
}

/** Hash the exact normalized draft payload, excluding only the hash itself. */
export function postingDraft(entry: Partial<JournalEntry>, lines: Partial<JournalLine>[]): JournalDraft {
  const parsed = parseJournalPayload({ ...entry, lines })
  const { sourceHash: _previousHash, ...sourceEntry } = entry
  const finalEntry = { ...sourceEntry, entryDate: parsed.entryDate, memo: parsed.memo, currency: parsed.currency }
  const finalLines = lines.map((line, index) => ({ ...line, ...parsed.lines[index] }))
  const sourceHash = createHash('sha256')
    .update(JSON.stringify({ entry: finalEntry, lines: finalLines })).digest('hex')
  return { entry: { ...finalEntry, sourceHash }, lines: finalLines }
}

/** Compatibility API: net same-day postings only; never silently discard later events. */
export function singleDayDraft(drafts: JournalDraft[], origin: string, api: string): JournalDraft | null {
  if (!drafts.length) return null
  if (drafts.some(({ entry }) => entry.entryDate !== origin || entry.idempotencyKey?.includes(':refund:'))) {
    throw new Error(`Multiple accounting events require ${api}`)
  }
  const grouped = new Map<string, { line: Partial<JournalLine>; net: number }>()
  for (const draft of drafts) {
    for (const { debit, credit, ...line } of draft.lines) {
      const key = JSON.stringify(line)
      const previous = grouped.get(key)
      const net = (previous?.net || 0) + cents(debit, 'Debit') - cents(credit, 'Credit')
      grouped.set(key, { line, net })
    }
  }
  const lines = [...grouped.values()].filter(({ net }) => net !== 0)
    .map(({ line, net }) => ({ ...line, debit: Math.max(0, net) / 100, credit: Math.max(0, -net) / 100 }))
  const entry = drafts[0].entry
  return postingDraft({ ...entry, idempotencyKey: `${entry.sourceType}:${entry.sourceId}` }, lines)
}