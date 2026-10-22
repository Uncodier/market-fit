"use client"

import { useCallback } from "react"
import { format } from "date-fns"
import { enUS, es, fr, de, ja } from "date-fns/locale"
import { useLocalization } from "@/app/context/LocalizationContext"
import { documentT, resolveDocumentLocale } from "@/app/lib/i18n/document-t"

type Translate = ReturnType<typeof useLocalization>["t"]

/** Match the site document language; use the UI language only when it is unset. */
export function useInvoiceLocalization(siteLocale?: string | null) {
  const { locale: uiLocale, t: uiT } = useLocalization()
  const locale = siteLocale ? resolveDocumentLocale(siteLocale) : uiLocale
  const t = useCallback<Translate>((key, params) => (
    siteLocale ? documentT(siteLocale, key, params) : uiT(key, params)
  ), [siteLocale, uiT])
  return { locale, t }
}

export function formatInvoiceDate(dateString: string, locale: string) {
  try {
    const dateLocales = { en: enUS, es, fr, de, ja }
    return format(new Date(dateString), "MMM d, yyyy", {
      locale: dateLocales[locale as keyof typeof dateLocales] || enUS,
    })
  } catch {
    return dateString
  }
}

/** Display labels only: payment identifiers and provider names are never changed. */
export function formatInvoicePaymentMethod(method: string, t: Translate) {
  if (!method) return t("public.invoice.notSpecified")
  const labels: Record<string, string> = {
    credit_card: "creditCard", debit_card: "debitCard", bank_transfer: "bankTransfer",
    cash: "cash", check: "check", crypto: "crypto", wire_transfer: "wireTransfer",
  }
  const providers: Record<string, string> = {
    paypal: "PayPal", stripe: "Stripe", apple_pay: "Apple Pay", google_pay: "Google Pay",
    venmo: "Venmo", zelle: "Zelle",
  }
  const key = labels[method.toLowerCase()]
  if (key) return t(`public.invoice.payment.${key}`)
  return providers[method.toLowerCase()] || method.replace(/_/g, " ").split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}