import { JournalEntry, JournalLine } from '../types'
import crypto from 'crypto'

function hashSource(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Raw sale row from Supabase (snake_case). */
export interface SaleSource {
  id: string
  site_id: string
  status: string
  amount: number
  amount_due: number
  sale_date: string
  currency?: string | null
  location_id?: string | null
}

/** Raw sale_order row from Supabase (snake_case). */
export interface SaleOrderSource {
  tax_total?: number | null
  taxTotal?: number | null
}

/** Raw expense/transaction row from Supabase (snake_case). */
export interface ExpenseSource {
  id: string
  site_id: string
  amount: number
  category: string
  date: string
  currency: string
  description?: string | null
  location_id?: string | null
}

export type JournalDraft = {
  entry: Partial<JournalEntry>
  lines: Partial<JournalLine>[]
}

export function buildFromSale(
  sale: SaleSource,
  order: SaleOrderSource | null
): JournalDraft | null {
  if (sale.status !== 'completed') {
    return null
  }

  const amountDue = Number(sale.amount_due) || 0
  const totalAmount = Number(sale.amount) || 0
  const taxTotal = Number(order?.tax_total ?? order?.taxTotal ?? 0) || 0
  const revenue = round2(totalAmount - taxTotal)
  const locId = sale.location_id || null

  const entry: Partial<JournalEntry> = {
    siteId: sale.site_id,
    entryDate: sale.sale_date,
    memo: `Sale ${sale.id}`,
    sourceType: 'sale',
    sourceId: sale.id,
    idempotencyKey: `sale:${sale.id}`,
    currency: sale.currency || 'USD',
    sourceHash: hashSource({
      status: sale.status,
      amount: totalAmount,
      amount_due: amountDue,
      tax_total: taxTotal,
      location_id: locId,
      date: sale.sale_date,
    }),
  }

  const lines: Partial<JournalLine>[] = []
  const paidAmount = round2(totalAmount - amountDue)

  if (paidAmount > 0) {
    lines.push({ accountCode: '1000', debit: paidAmount, credit: 0, locationId: locId })
  }
  if (amountDue > 0) {
    lines.push({ accountCode: '1100', debit: amountDue, credit: 0, locationId: locId })
  }
  // Fully unpaid with zero paid: still need DR AR for full amount (covered by amountDue)
  // Fully paid: only cash line above

  lines.push({ accountCode: '4000', debit: 0, credit: revenue, locationId: locId })

  if (taxTotal > 0) {
    lines.push({ accountCode: '2100', debit: 0, credit: taxTotal, locationId: locId })
  }

  const sumDebits = round2(lines.reduce((acc, l) => acc + (l.debit || 0), 0))
  const sumCredits = round2(lines.reduce((acc, l) => acc + (l.credit || 0), 0))

  if (Math.abs(sumDebits - sumCredits) > 0.01) {
    console.error('Unbalanced sale entry:', sumDebits, sumCredits, sale.id)
    return null
  }

  return { entry, lines }
}

export function buildFromExpense(tx: ExpenseSource, accountCode: string): JournalDraft | null {
  const amount = Number(tx.amount) || 0
  if (amount <= 0) return null

  const locId = tx.location_id || null

  const entry: Partial<JournalEntry> = {
    siteId: tx.site_id,
    entryDate: tx.date,
    memo: tx.description || `Expense ${tx.id}`,
    sourceType: 'expense',
    sourceId: tx.id,
    idempotencyKey: `expense:${tx.id}`,
    currency: tx.currency,
    sourceHash: hashSource({
      amount,
      category: tx.category,
      date: tx.date,
      location_id: locId,
    }),
  }

  return {
    entry,
    lines: [
      { accountCode, debit: amount, credit: 0, locationId: locId },
      { accountCode: '1000', debit: 0, credit: amount, locationId: locId },
    ],
  }
}
