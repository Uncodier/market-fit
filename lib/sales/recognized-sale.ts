const EXCLUDED_SALE_STATUSES = new Set(["cancelled", "refunded"])

/** Active sale value is not cash collected. Order cancellation overrides sale status. */
export function isRecognizedRevenueSale(sale: {
  status?: string | null
  amount_due?: number | string | null
  order_statuses?: string[]
}): boolean {
  const status = (sale?.status || "").trim().toLowerCase()
  if (!status || EXCLUDED_SALE_STATUSES.has(status)) return false
  if (sale.order_statuses?.some(status => status.trim().toLowerCase() === "cancelled")) return false
  if (status === "completed" || status === "pending") return true
  return false
}
