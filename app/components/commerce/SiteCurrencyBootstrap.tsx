"use client"

import { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

/** Syncs the workspace site default currency into display currency. */
export function SiteCurrencyBootstrap() {
  const { currentSite } = useSite()
  const { setStoreCurrency } = useDisplayCurrency()

  useEffect(() => {
    setStoreCurrency(currentSite?.settings?.currency ?? null)
  }, [currentSite?.settings?.currency, setStoreCurrency])

  return null
}
