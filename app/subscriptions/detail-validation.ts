import { isDateOnly } from "@/lib/finance/due-date"
import { getSubscriptionBillingDate } from "./billing-period"

export function getSubscriptionAmountError(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 999999999999) {
    return "Enter a valid amount of zero or more"
  }
  const cents = value * 100
  if (!Number.isSafeInteger(Math.round(cents)) || Math.abs(cents - Math.round(cents)) > 0.000001) {
    return "Use no more than two decimal places"
  }
  return null
}

export function getSubscriptionEndDateError(value: unknown, startDate: string): string | null {
  if (value === null || value === "") return null
  if (!isDateOnly(value)) return "Enter a valid end date (YYYY-MM-DD)"
  const start = getSubscriptionBillingDate(startDate)
  if (!start) return "Unable to verify the subscription start date"
  return value < start ? "End date cannot be before start date" : null
}