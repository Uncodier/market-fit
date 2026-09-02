"use client"

import { useLayoutEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

/**
 * Applies the site default locale (or falls back to browser location) for base load 
 * when the visitor has no saved makinari-locale preference. Does not persist.
 */
export function SiteLocaleBootstrap({ locale }: { locale?: string | null }) {
  const { applyUnresolvedLocale, isReady } = useLocalization()

  useLayoutEffect(() => {
    if (!isReady) return
    applyUnresolvedLocale(locale)
  }, [locale, isReady, applyUnresolvedLocale])

  return null
}
