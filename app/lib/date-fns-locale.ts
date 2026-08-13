import { de, enUS, es, fr, ja, type Locale } from "date-fns/locale"
import type { SupportedLocale } from "@/app/context/LocalizationContext"

const DATE_FNS_LOCALES: Record<SupportedLocale, Locale> = {
  en: enUS,
  es,
  fr,
  de,
  ja,
}

export function getDateFnsLocale(locale: SupportedLocale): Locale {
  return DATE_FNS_LOCALES[locale] || enUS
}
