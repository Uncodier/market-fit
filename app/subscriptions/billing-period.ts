import { isDateOnly } from "@/lib/finance/due-date"

/** The next billing anchor identifies the cycle awaiting an invoice, including the first cycle. */
export function getSubscriptionBillingDate(value?: string | null): string | null {
  if (!value) return null
  if (value.length === 10 && isDateOnly(value)) return value
  if (!isDateOnly(value.slice(0, 10))) return null
  const date = new Date(value)
  const day = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
  return isDateOnly(day) ? day : null
}