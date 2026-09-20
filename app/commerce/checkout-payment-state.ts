import { roundMoney } from "@/app/commerce/taxes"

export type CheckoutPaymentLike = {
  amount?: number | string | null
  [key: string]: unknown
}

export function resolveCheckoutPaymentState<T extends CheckoutPaymentLike>(
  orderTotal: number,
  existingPayments: T[] | null | undefined,
  newPayments: T[] | null | undefined,
  existingBalance?: {
    amount?: number | string | null
    amountDue?: number | string | null
  },
) {
  const previous = Array.isArray(existingPayments) ? existingPayments : []
  const incoming = Array.isArray(newPayments) ? newPayments : []
  const payments = [...previous, ...incoming]
  const recordedPreviousPaid = previous.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  )
  const impliedPreviousPaid =
    existingBalance?.amountDue != null
      ? Math.max(
          0,
          (Number(existingBalance.amount) || orderTotal) -
            Number(existingBalance.amountDue),
        )
      : 0
  const newPaid = incoming.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  )
  const totalPaid = roundMoney(
    Math.max(recordedPreviousPaid, impliedPreviousPaid) + newPaid,
  )
  const amountDue = roundMoney(Math.max(0, orderTotal - totalPaid))

  return {
    payments,
    totalPaid,
    amountDue,
    isFullyPaid: amountDue <= 0.009,
  }
}
