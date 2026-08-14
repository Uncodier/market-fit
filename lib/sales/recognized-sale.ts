const EXCLUDED_SALE_STATUSES = new Set(["cancelled", "refunded"])

/** Completed or fully paid sales count as revenue and can post a journal entry. */
export function isRecognizedRevenueSale(sale: {
  status?: string | null
  amount_due?: number | string | null
}): boolean {
  const status = (sale?.status || "").toLowerCase()
  if (!status || EXCLUDED_SALE_STATUSES.has(status)) return false
  if (status === "completed") return true
  return status === "pending" && Number(sale.amount_due) === 0
}
