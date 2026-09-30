import type { JournalEntry, JournalLine } from '@/app/types'
import type { SaleRefundSource } from './builder-types'
import type { PaymentGroup } from './posting-payments'
import { cents, postingCurrency, postingDate, postingDraft, postingLine, sumCents } from './posting-core'

export function refundDrafts(
  entry: Partial<JournalEntry>, refunds: SaleRefundSource[], payments: PaymentGroup[],
  total: number, tax: number, incomeAccount: string, dimensions: Partial<JournalLine>,
) {
  const byId = new Map<string, { id: string; amount: number; date: string; currency: string }>()
  for (const refund of refunds) {
    if (!refund.id || typeof refund.id !== 'string') throw new Error('Refund ID is required')
    const normalized = { id: refund.id, amount: cents(refund.amount, 'Refund amount'),
      date: postingDate(refund.refunded_at), currency: postingCurrency(refund.currency) }
    if (normalized.amount <= 0 || normalized.currency !== entry.currency) throw new Error('Invalid refund amount or currency')
    if (normalized.date < entry.entryDate!) throw new Error('Refund predates the sale')
    const previous = byId.get(refund.id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) throw new Error('Conflicting duplicate refund')
    byId.set(refund.id, normalized)
  }
  let refunded = 0, revenueRefunded = 0, taxRefunded = 0, advancesReturned = 0
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(refund => {
    const received = sumCents(payments.filter(payment => payment.date <= refund.date).map(payment => payment.amount))
    refunded = sumCents([refunded, refund.amount])
    if (refunded > received) throw new Error('Refunds exceed cash received on the refund date')
    const advanceBalance = Math.max(0, received - total - advancesReturned)
    const advance = Math.min(advanceBalance, refund.amount)
    advancesReturned += advance
    const reversal = refund.amount - advance
    revenueRefunded += reversal
    if (revenueRefunded > total) throw new Error('Refunds exceed recognized sale value')
    // Cumulative allocation avoids losing/duplicating a tax cent over partial refunds.
    const cumulativeTax = total ? Number((BigInt(revenueRefunded) * BigInt(tax) + BigInt(Math.floor(total / 2))) / BigInt(total)) : 0
    const refundTax = cumulativeTax - taxRefunded
    taxRefunded = cumulativeTax
    const lines: Partial<JournalLine>[] = []
    if (advance) lines.push(postingLine('2300', advance, 0, dimensions))
    if (reversal - refundTax) lines.push(postingLine(incomeAccount, reversal - refundTax, 0, dimensions))
    if (refundTax) lines.push(postingLine('2100', refundTax, 0, dimensions))
    lines.push(postingLine('1000', 0, refund.amount, dimensions))
    return postingDraft({ ...entry, entryDate: refund.date, memo: `Refund · ${entry.memo}`,
      idempotencyKey: `sale:${entry.sourceId}:refund:${refund.id}` }, lines)
  })
}