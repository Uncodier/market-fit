"use client"

import { useEffect } from "react"
import {
  isSupportedLocale,
  useLocalization,
} from "@/app/context/LocalizationContext"

/**
 * Applies the site default locale for shop storefront base load when the
 * visitor has no saved makinari-locale preference. Does not persist.
 */
export function SiteLocaleBootstrap({ locale }: { locale?: string | null }) {
  const { applySiteDefaultLocale, isReady } = useLocalization()

  useEffect(() => {
    if (!isReady) return
    if (isSupportedLocale(locale)) {
      applySiteDefaultLocale(locale)
    }
  }, [locale, isReady, applySiteDefaultLocale])

  return null
}
