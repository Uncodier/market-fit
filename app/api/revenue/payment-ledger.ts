import { cents, postingDate, sumCents } from "@/app/accounting/posting-core"
import type { ReportSale } from "@/app/api/sales/sales-query"
import { salesCurrency } from "@/lib/sales/report-format"

export type CashMovement = { date: string; amount: number }
export type SaleLedger = {
  sale: ReportSale
  receipts: CashMovement[]
  refunds: CashMovement[]
  receiptIssue: boolean
  refundIssue: boolean
  due: number | null
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid payment")
  return value as Record<string, unknown>
}

function money(value: unknown): number | null {
  try { return cents(value, "Sale balance") } catch { return null }
}

/** Never turn a legacy balance into a receipt with an invented date. Values are cents. */
export function salePaymentLedger(sale: ReportSale): SaleLedger {
  const total = money(sale.amount)
  const balance = money(sale.amount_due)
  const due = total !== null && balance !== null && balance <= total ? balance : null
  const ledger: SaleLedger = { sale, receipts: [], refunds: [], receiptIssue: false, refundIssue: false, due }
  const currency = salesCurrency(sale.currency)
  const paymentIds = new Map<string, string>()
  if (sale.payments != null && !Array.isArray(sale.payments)) ledger.receiptIssue = true
  for (const value of Array.isArray(sale.payments) ? sale.payments : []) {
    try {
      const payment = record(value)
      const amount = cents(payment.amount, "Payment amount")
      if (!amount) continue
      if (typeof payment.status === "string" && ["pending", "processing", "failed", "cancelled", "canceled"].includes(payment.status)) continue
      // Current writers use completed; older manual receipts omit status.
      if (payment.status != null && payment.status !== "completed") throw new Error("Unverified payment status")
      if (payment.legacy_inferred === true || payment.method === "legacy_balance") throw new Error("Inferred receipt")
      if (payment.currency != null && salesCurrency(payment.currency) !== currency) throw new Error("Currency mismatch")
      const date = postingDate(payment.date as string)
      if (payment.id != null) {
        if (typeof payment.id !== "string" || !payment.id.trim()) throw new Error("Invalid payment ID")
        const fingerprint = JSON.stringify({ amount, date })
        if (paymentIds.has(payment.id)) {
          if (paymentIds.get(payment.id) !== fingerprint) throw new Error("Conflicting receipt")
          continue
        }
        paymentIds.set(payment.id, fingerprint)
      }
      ledger.receipts.push({ date, amount })
    } catch { ledger.receiptIssue = true }
  }
  const received = sumCents(ledger.receipts.map(payment => payment.amount))
  // A larger recorded amount may be an advance after a discount; preserve that cash.
  if (total === null || (due !== null && total !== null && received < total - due) ||
      (due === null && !ledger.receipts.length)) ledger.receiptIssue = true
  if (total !== null && due !== null && !ledger.receiptIssue && Math.max(0, total - received) !== due) {
    ledger.due = null
    ledger.receiptIssue = true
  }

  const refundIds = new Map<string, string>()
  for (const refund of sale.refunds || []) {
    try {
      const amount = cents(refund.amount, "Refund amount")
      if (!amount || !refund.id || salesCurrency(refund.currency) !== currency) throw new Error("Invalid refund")
      const date = postingDate(refund.refunded_at)
      const fingerprint = JSON.stringify({ amount, date })
      if (refundIds.has(refund.id)) {
        if (refundIds.get(refund.id) !== fingerprint) throw new Error("Conflicting refund")
        continue
      }
      refundIds.set(refund.id, fingerprint)
      ledger.refunds.push({ date, amount })
    } catch { ledger.refundIssue = true }
  }
  if (sale.status.trim().toLowerCase() === "refunded" && !ledger.refunds.length) ledger.refundIssue = true
  if (!ledger.receiptIssue) {
    let returned = 0
    for (const refund of [...ledger.refunds].sort((a, b) => a.date.localeCompare(b.date))) {
      returned = sumCents([returned, refund.amount])
      const receivedByDate = sumCents(ledger.receipts.filter(payment => payment.date <= refund.date).map(payment => payment.amount))
      if (returned > receivedByDate) ledger.refundIssue = true
    }
  }
  return ledger
}