export type LinkedSaleForCancel = {
  status: string
  payments?: Array<{ amount?: number }> | null
  amount?: number | null
  amount_due?: number | null
}

export function hasPriorPayments(sale: LinkedSaleForCancel): boolean {
  const payments = sale.payments
  if (Array.isArray(payments) && payments.some((payment) => Number(payment?.amount) > 0)) {
    return true
  }

  const amount = Number(sale.amount) || 0
  const amountDue = Number(sale.amount_due)
  return Number.isFinite(amountDue) && amountDue < amount
}

export function shouldCancelLinkedSale(
  orderStatus: string | null | undefined,
  sale: LinkedSaleForCancel | null | undefined
): boolean {
  if (orderStatus !== "pending") return false
  if (!sale) return false
  if (sale.status !== "pending") return false
  return !hasPriorPayments(sale)
}
