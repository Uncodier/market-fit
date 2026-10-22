import { roundMoney } from "@/app/commerce/taxes"

export interface PaymentEntry {
  method: string
  amount: number
  tendered: number
  change: number
}

export function remainingPaymentAmount(
  totalAmount: number,
  payments: readonly Pick<PaymentEntry, "amount">[],
): number {
  const totalPaid = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0))
  return roundMoney(Math.max(0, roundMoney(totalAmount) - totalPaid))
}

/** Normalize newly entered payments only; never rewrite persisted receipt evidence. */
export function createPaymentEntry(
  method: string,
  input: string,
  remainingAmount: number,
): PaymentEntry | null {
  const parsed = Number(input)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isFinite(remainingAmount) || remainingAmount <= 0) {
    return null
  }

  const entered = roundMoney(parsed)
  const remaining = roundMoney(remainingAmount)
  if (!Number.isFinite(entered) || entered <= 0 || !Number.isFinite(remaining) || remaining <= 0) {
    return null
  }

  const amount = roundMoney(Math.min(entered, remaining))
  const tendered = method === "cash" ? entered : amount
  const change = method === "cash" ? roundMoney(tendered - amount) : 0
  return { method, amount, tendered, change }
}