import { parseJournalPayload } from '@/app/accounting/validation'
import { accountingDate, accountingDateRange } from '@/app/accounting/dates'

const valid = { entryDate: '2026-09-29', memo: 'Reclassification', currency: 'USD',
  lines: [{ accountCode: '1000', debit: 0.3, credit: 0 }, { accountCode: '3000', debit: 0, credit: 0.3 }] }

describe('journal boundary validation', () => {
  it('accepts exact balanced cents and normalizes currency', () => {
    expect(parseJournalPayload({ ...valid, currency: ' usd ' }).currency).toBe('USD')
  })
  it.each([[], [valid.lines[0]], [{ ...valid.lines[0], debit: 0 }, valid.lines[1]],
    [{ ...valid.lines[0], debit: -1 }, valid.lines[1]], [{ ...valid.lines[0], debit: NaN }, valid.lines[1]],
    [{ ...valid.lines[0], debit: Infinity }, valid.lines[1]], [{ ...valid.lines[0], debit: 0.301 }, valid.lines[1]],
    [{ ...valid.lines[0], credit: 0.3 }, valid.lines[1]], [{ ...valid.lines[0], debit: 0.31 }, valid.lines[1]],
  ].map(lines => ({ lines })))('rejects empty, malformed, fractional or unbalanced lines: %j', ({ lines }) => {
    expect(() => parseJournalPayload({ ...valid, lines })).toThrow()
  })
  it('rejects unknown currency and invalid date', () => {
    expect(() => parseJournalPayload({ ...valid, currency: 'ZZZ' })).toThrow()
    expect(() => parseJournalPayload({ ...valid, entryDate: '2026-02-30' })).toThrow()
  })
  it('includes the complete final UTC day, without the following day', () => {
    expect(accountingDateRange('2026-08-01', '2026-08-31')).toEqual({
      from: '2026-08-01T00:00:00.000Z', toExclusive: '2026-09-01T00:00:00.000Z',
    })
    expect(accountingDate('2026-09-01')).toBe('2026-09-01')
    expect(() => accountingDateRange('2026-09-02', '2026-09-01')).toThrow()
  })
})