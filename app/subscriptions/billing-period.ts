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

export interface SubscriptionInvoicePeriod {
  subscription_id: string
  billing_cycle: string
  billing_period_start: string
  billing_period_end: string
}

/** Explicit periods are independent of issue dates; preserve the verified cycle instant when selected. */
export function getSubscriptionInvoicePeriod(
  subscriptionId: string,
  nextBillingDate?: string | null,
  billingDate?: string,
): SubscriptionInvoicePeriod | null {
  const verifiedDate = getSubscriptionBillingDate(nextBillingDate)
  if (!verifiedDate || (billingDate !== undefined && !isDateOnly(billingDate))) return null
  const start = billingDate ?? verifiedDate
  const anchor = new Date(`${start}T00:00:00.000Z`)
  const nextMonth = new Date(anchor)
  nextMonth.setUTCDate(1)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  const monthEnd = new Date(nextMonth)
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1)
  monthEnd.setUTCDate(0)
  nextMonth.setUTCDate(Math.min(anchor.getUTCDate(), monthEnd.getUTCDate()))
  const end = nextMonth.toISOString().slice(0, 10)
  if (!isDateOnly(end)) return null
  return {
    subscription_id: subscriptionId,
    billing_cycle: new Date(start === verifiedDate ? nextBillingDate! : start).toISOString(),
    billing_period_start: start,
    billing_period_end: end,
  }
}