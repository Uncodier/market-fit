import type { JournalEntry, JournalLine } from '../types'
import type { PaymentSource } from './builder-types'
import { cents, postingCurrency, postingDate, postingDraft, postingLine, sumCents } from './posting-core'

export type PaymentGroup = { date: string; amount: number }

/**
 * Only sources with no payment history may infer cash from their balance at origin.
 * A partially missing or undated recorded history requires review, not invented dates.
 */
export function paymentGroups(
  payments: PaymentSource[] | null | undefined, total: number, due: number, origin: string, currency: string,
): PaymentGroup[] {
  if (due > total) throw new Error('Amount due exceeds the source total')
  if (payments != null && !Array.isArray(payments)) throw new Error('Invalid payment history')
  if (!payments?.length) return total > due ? [{ date: origin, amount: total - due }] : []

  const dates = new Map<string, number>()
  const ids = new Map<string, string>()
  for (const payment of payments) {
    if (!payment) throw new Error('Invalid payment record')
    const amount = cents(payment.amount, 'Payment amount')
    if (payment.currency != null && postingCurrency(payment.currency) !== currency) {
      throw new Error('Payment currency differs from the source currency')
    }
    if (amount === 0) continue
    if (!payment.date) throw new Error('Recorded payments require a date; review historical payment data')
    const date = postingDate(payment.date)
    if (date < origin) throw new Error('Payments before recognition require advance-payment review')
    if (payment.id != null) {
      if (typeof payment.id !== 'string' || !payment.id.trim()) throw new Error('Invalid payment ID')
      const fingerprint = JSON.stringify({ date, amount })
      if (ids.has(payment.id)) {
        if (ids.get(payment.id) !== fingerprint) throw new Error('Conflicting duplicate payment ID')
        continue
      }
      ids.set(payment.id, fingerprint)
    }
    dates.set(date, sumCents([dates.get(date) || 0, amount]))
  }
  const groups = [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }))
  if (sumCents(groups.map(group => group.amount)) < total - due) {
    throw new Error('Recorded payments do not explain the paid balance; review historical payment data')
  }
  return groups
}

export function paymentDrafts(
  entry: Partial<JournalEntry>, groups: PaymentGroup[], total: number, dimensions: Partial<JournalLine>,
) {
  let remaining = total
  const sale = entry.sourceType === 'sale'
  return groups.map(group => {
    const settlement = Math.min(remaining, group.amount)
    const advance = group.amount - settlement
    remaining -= settlement
    const lines = [postingLine('1000', sale ? group.amount : 0, sale ? 0 : group.amount, dimensions)]
    if (settlement) lines.push(postingLine(sale ? '1100' : '2200', sale ? 0 : settlement, sale ? settlement : 0, dimensions))
    if (advance) lines.push(postingLine(sale ? '2300' : '1300', sale ? 0 : advance, sale ? advance : 0, dimensions))
    return postingDraft({ ...entry, entryDate: group.date, memo: `${sale ? 'Receipt' : 'Payment'} · ${entry.memo}`,
      idempotencyKey: `${entry.sourceType}:${entry.sourceId}:payment:${group.date}` }, lines)
  })
}