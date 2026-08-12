import { documentT } from "@/app/lib/i18n/document-t"

export type DocumentShippingAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

export type DocumentOrderMeta = {
  fulfillmentMethod?: string | null
  paymentMethod?: string | null
  shippingAddress?: DocumentShippingAddress | null
}

function clean(value?: string | null): string | null {
  const v = value?.trim()
  return v ? v : null
}

type SalePaymentSource = {
  payment_method?: string | null
  payments?: Array<{ date?: string; method?: string | null }> | null
}

/** Latest payment method on a sale, falling back to sale.payment_method. */
export function resolveSalePaymentMethod(
  sale?: SalePaymentSource | SalePaymentSource[] | null
): string | null {
  const row = Array.isArray(sale) ? sale[0] : sale
  if (!row) return null
  if (Array.isArray(row.payments) && row.payments.length > 0) {
    const latest = [...row.payments]
      .filter((p) => Boolean(p?.method))
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      )[0]
    if (latest?.method) return String(latest.method)
  }
  return row.payment_method ? String(row.payment_method) : null
}

export function translateFulfillmentMethod(
  locale: string | null | undefined,
  method?: string | null
): string | null {
  if (!method || method === "none") return null
  const key = `orders.kanban.fulfillment.${method}`
  const translated = documentT(locale, key)
  return translated === key ? method.replace(/_/g, " ") : translated
}

export function translatePaymentMethod(
  locale: string | null | undefined,
  method?: string | null
): string | null {
  if (!method) return null
  const key = method.toLowerCase()
  const map: Record<string, string> = {
    cash: "sales.paymentMethod.cash",
    cash_on_pickup: "checkout.cashOnPickup",
    credit_card: "sales.paymentMethod.creditCard",
    debit_card: "sales.paymentMethod.debitCard",
    bank_transfer: "sales.paymentMethod.bankTransfer",
    wire_transfer: "sales.paymentMethod.wireTransfer",
    check: "sales.paymentMethod.check",
    crypto: "sales.paymentMethod.crypto",
    card: "sales.paymentMethod.creditCard",
    stripe: "stripe",
  }
  const i18nKey = map[key]
  if (!i18nKey) return method.replace(/_/g, " ")
  const translated = documentT(locale, i18nKey)
  if (translated === i18nKey && key === "stripe") return "Stripe"
  return translated === i18nKey ? method.replace(/_/g, " ") : translated
}

export function formatShippingAddressLines(
  address?: DocumentShippingAddress | null
): string[] {
  if (!address) return []
  const cityLine = [clean(address.city), clean(address.state), clean(address.zip)]
    .filter(Boolean)
    .join(", ")
  return [
    clean(address.line1),
    clean(address.line2),
    cityLine || null,
    clean(address.country),
  ].filter(Boolean) as string[]
}
