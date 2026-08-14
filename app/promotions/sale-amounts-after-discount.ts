export function paidOnSale(sale: {
  amount?: number | string | null
  amount_due?: number | string | null
  payments?: Array<{ amount?: number | string | null }> | null
} | null | undefined): number {
  if (!sale) return 0

  const previousAmount = Number(sale.amount) || 0
  const previousDue = Number(sale.amount_due)
  const paidFromBalance = Number.isFinite(previousDue)
    ? Math.max(0, previousAmount - previousDue)
    : 0
  const paidFromPayments = (sale.payments || []).reduce(
    (sum, payment) => sum + (Number(payment?.amount) || 0),
    0
  )
  return Math.max(paidFromBalance, paidFromPayments)
}

export function saleAmountsAfterDiscount(
  newTotal: number,
  sale?: {
    amount?: number | string | null
    amount_due?: number | string | null
    payments?: Array<{ amount?: number | string | null }> | null
    status?: string | null
  } | null
): { amount: number; amount_due: number; status?: string } {
  const amount = Math.max(0, Number(newTotal) || 0)
  const amountDue = Math.max(0, Math.round((amount - paidOnSale(sale)) * 100) / 100)
  const next: { amount: number; amount_due: number; status?: string } = {
    amount,
    amount_due: amountDue,
  }
  if (amountDue === 0 && sale?.status === "pending") {
    next.status = "completed"
  }
  return next
}
