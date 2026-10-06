/** Financial due dates are calendar dates, never timestamps or browser-local instants. */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return value >= "0001-01-01" && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function normalizeDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  if (!isDateOnly(value)) throw new Error("Enter a valid due date (YYYY-MM-DD)")
  return value
}

/** Preserve net terms relative to the configured next billing cycle, including negative offsets. */
export function getSubscriptionInvoiceDueDate(
  dueDate: string | null | undefined,
  nextBillingDate: string | null | undefined,
  invoiceDate: string,
): string | null {
  const due = normalizeDueDate(dueDate)
  if (!due || !nextBillingDate) return null
  if (!isDateOnly(nextBillingDate.slice(0, 10))) throw new Error("Invalid subscription billing date")
  // Legacy timestamp anchors represent instants: normalize to their UTC calendar date.
  const billingInstant = new Date(nextBillingDate)
  const billingDate = isDateOnly(nextBillingDate) ? nextBillingDate
    : Number.isNaN(billingInstant.getTime()) ? "" : billingInstant.toISOString().slice(0, 10)
  if (!isDateOnly(billingDate) || !isDateOnly(invoiceDate)) throw new Error("Invalid subscription billing date")
  const offset = Date.parse(`${due}T00:00:00Z`) - Date.parse(`${billingDate}T00:00:00Z`)
  const result = new Date(Date.parse(`${invoiceDate}T00:00:00Z`) + offset).toISOString().slice(0, 10)
  return normalizeDueDate(result)
}

export function formatDueDate(value?: string | null): string {
  if (!isDateOnly(value)) return "Not set"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`))
}