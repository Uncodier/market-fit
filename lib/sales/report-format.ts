export function salesCurrency(value: unknown): string {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^[A-Z]{3}$/.test(currency) ? currency : "UNSPECIFIED"
}

export function formatSalesMoney(value: number, currency = "UNSPECIFIED", compact = false): string {
  if (currency === "UNSPECIFIED") {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} (currency unspecified)`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, currencyDisplay: "code",
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  }).format(value)
}

export function salesPercentChange(previous: number, current: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatSalesChange(change: number | null): string {
  if (change === null) return "Not comparable (zero baseline)"
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`
}