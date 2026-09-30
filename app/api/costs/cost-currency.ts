import { CostReportError } from "./cost-input"

/** Unknown stored values remain an explicit bucket, never a guessed ISO currency. */
export function costCurrencyBucket(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^[A-Z]{3}$/.test(code) ? code : "UNSPECIFIED"
}

export function selectCostCurrency(
  rows: Array<{ currency?: string | null }>, selected: string | null,
) {
  const availableCurrencies = [...new Set(rows.map((row) => costCurrencyBucket(row.currency)))].sort()
  if (selected === null && availableCurrencies.length > 1) {
    throw new CostReportError(
      "Select a currency to view costs without combining currency groups.", 422, availableCurrencies,
    )
  }
  return { currency: selected ?? availableCurrencies[0] ?? null, availableCurrencies }
}