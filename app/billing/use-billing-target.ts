"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useSearchParams } from "next/navigation"

/** Never render another site's checkout while resolving an upgrade deep link. */
export function useBillingTarget() {
  const { sites, currentSite, setCurrentSite, isLoading } = useSite()
  const searchParams = useSearchParams()
  const requestedId = searchParams?.get("siteId") ?? null
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || !requestedId || currentSite?.id === requestedId) return
    const target = sites.find(site => site.id === requestedId)
    if (!target) return
    let active = true
    void Promise.resolve(setCurrentSite(target)).catch(() => {
      if (active) setError("The billing project could not be selected. Please try again.")
    })
    return () => { active = false }
  }, [isLoading, requestedId, currentSite?.id, sites, setCurrentSite])

  const missing = !isLoading && requestedId && !sites.some(site => site.id === requestedId)
  const targetError = missing ? "This project's billing is not available to your account." : error
  return { pending: !!requestedId && currentSite?.id !== requestedId && !targetError, error: targetError, requestedId }
}