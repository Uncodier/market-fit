import enTranslations from "@/app/context/locales/en.json"
import esTranslations from "@/app/context/locales/es.json"
import frTranslations from "@/app/context/locales/fr.json"
import deTranslations from "@/app/context/locales/de.json"
import jaTranslations from "@/app/context/locales/ja.json"

export type DocumentLocale = "en" | "es" | "fr" | "de" | "ja"

const translations: Record<DocumentLocale, Record<string, string>> = {
  en: enTranslations as Record<string, string>,
  es: esTranslations as Record<string, string>,
  fr: frTranslations as Record<string, string>,
  de: deTranslations as Record<string, string>,
  ja: jaTranslations as Record<string, string>,
}

const LOCALE_TO_BCP47: Record<DocumentLocale, string> = {
  en: "en-US",
  es: "es",
  fr: "fr",
  de: "de",
  ja: "ja",
}

const SUPPORTED: DocumentLocale[] = ["en", "es", "fr", "de", "ja"]

export function resolveDocumentLocale(value?: string | null): DocumentLocale {
  if (value && SUPPORTED.includes(value as DocumentLocale)) {
    return value as DocumentLocale
  }
  return "en"
}

export function localeToBcp47(locale?: string | null): string {
  return LOCALE_TO_BCP47[resolveDocumentLocale(locale)]
}

export function documentT(
  locale: string | null | undefined,
  key: string,
  params?: Record<string, string | number>
): string {
  const resolved = resolveDocumentLocale(locale)
  const raw =
    translations[resolved]?.[key] ||
    translations.en?.[key] ||
    key

  if (!params) return raw

  return Object.entries(params).reduce(
    (text, [name, value]) =>
      text.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), String(value)),
    raw
  )
}

export function formatDocumentMoney(
  amount: number,
  currency: string,
  locale?: string | null
): string {
  return new Intl.NumberFormat(localeToBcp47(locale), {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0)
}

export function formatDocumentDate(
  value?: string | null,
  locale?: string | null
): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(localeToBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export type DocumentStatusKind = "quotations" | "sales" | "orders" | "bills"

/** Translate a document status code using site locale keys (`orders.status.completed`, etc.). */
export function translateDocumentStatus(
  locale: string | null | undefined,
  status: string | null | undefined,
  kind: DocumentStatusKind
): string {
  if (!status) return ""
  const key = `${kind}.status.${status}`
  const translated = documentT(locale, key)
  return translated === key ? status.replace(/_/g, " ") : translated
}
