import { currencySchema } from "@/app/accounting/validation"

export function getSubscriptionCurrency(subscription: {
  currency?: string | null
  catalog_item?: { currency?: string | null } | null
}): string {
  return subscription.currency || subscription.catalog_item?.currency || "USD"
}

export function getSubscriptionCurrencyError(value: unknown): string | null {
  return currencySchema.safeParse(value).success ? null : "Select a valid currency"
}