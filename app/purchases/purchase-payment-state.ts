import type { Payment } from "@/app/types"

type PurchaseBalance = { amount: unknown; amount_due: unknown; payments?: Payment[] | null }

function money(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value))) {
    throw new Error("Invalid purchase payment balance")
  }
  return Number(value)
}

function positivePayments(payments: Payment[] | null | undefined): number {
  if (payments != null && !Array.isArray(payments)) throw new Error("Invalid purchase payments")
  return (payments ?? []).reduce((sum, payment) => sum + Math.max(0, money(payment?.amount)), 0)
}

/** Item edits change the liability, not the amount actually paid to the vendor. */
export function purchaseAmountDue(
  current: PurchaseBalance,
  amount: number,
  paymentUpdate?: { payments: Payment[]; amountDue?: number },
): number {
  const oldTotal = money(current.amount)
  const oldDue = money(current.amount_due)
  if (!Number.isFinite(amount) || amount < 0 || oldTotal < 0 || oldDue < 0 || oldDue > oldTotal) {
    throw new Error("Invalid purchase payment balance")
  }
  const recordedPaid = positivePayments(current.payments)
  const previousPaid = Math.max(oldTotal - oldDue, recordedPaid)
  if (!paymentUpdate && previousPaid > amount && recordedPaid < previousPaid) {
    throw new Error("Historical purchase payments require review before reducing the total below the paid amount")
  }
  if (paymentUpdate?.payments.some(payment => money(payment?.amount) < 0)) {
    throw new Error("Purchase payments cannot be negative")
  }
  const paid = paymentUpdate
    ? previousPaid + positivePayments(paymentUpdate.payments) - recordedPaid
    : previousPaid
  const due = Math.round(Math.max(0, amount - paid) * 100) / 100
  if (paymentUpdate?.amountDue !== undefined) {
    if (!Number.isFinite(paymentUpdate.amountDue) || Math.abs(paymentUpdate.amountDue - due) > 0.001) {
      throw new Error("Amount due does not match the purchase payment update")
    }
  }
  return due
}