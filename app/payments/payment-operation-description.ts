import type { PaymentOperationRow } from "./payment-dashboard-types"

export function paymentOperationDescription(operation: PaymentOperationRow): string {
  if (operation.transaction_type === "commission") {
    if (operation.details?.commission_basis !== "processing_included") {
      return "Platform Commission"
    }
    const rate = Number(operation.details.commission_rate)
    const label = Number.isFinite(rate) && rate > 0 && rate < 1
      ? `${Number((rate * 100).toFixed(2))}% · processing included`
      : "processing included"
    return `Total Card Payment Fee (${label})`
  }
  const currency = operation.details?.original_currency
  return currency && currency.toLowerCase() !== "usd"
    ? `Sale Revenue (Paid in ${currency.toUpperCase()})`
    : "Sale Revenue"
}