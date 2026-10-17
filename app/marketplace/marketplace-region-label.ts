import type { SupportedLocale } from "@/app/context/locale-preferences"
import { normalizeCountry } from "@/app/commerce/location-restrictions"

let regionCodes: Map<string, string> | undefined
const displayNames = new Map<SupportedLocale, Intl.DisplayNames>()

/** Translate presentation only; canonical country filter values remain unchanged. */
export function localizeMarketplaceRegion(country: string, fallback: string, locale: SupportedLocale): string {
  if (!regionCodes) {
    regionCodes = new Map()
    const englishNames = new Intl.DisplayNames(["en"], { type: "region" })
    for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second)
      const name = englishNames.of(code)
      if (!name || name === code || ["ZZ", "XA", "XB"].includes(code)) continue
      regionCodes.set(normalizeCountry(name), code)
      regionCodes.set(normalizeCountry(code), code)
    }
  }
  const code = regionCodes.get(normalizeCountry(country))
  if (!code) return fallback
  let names = displayNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region" })
    displayNames.set(locale, names)
  }
  return names.of(code) || fallback
}