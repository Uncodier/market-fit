"use client"

import type { Dispatch, SetStateAction } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Site } from "./site-types"
import { withTimeout } from "@/app/services/request-timeout"
import { markBillingRefreshed } from "./site-billing-freshness"
import { hydrateSiteBilling } from "./site-billing-data"
import { readSiteBilling } from "./read-site-billing"

export const BILLING_READ_TIMEOUT_MS = 8_000

type BillingRefreshDeps = {
  setSites: Dispatch<SetStateAction<Site[]>>
  setCurrentSite: Dispatch<SetStateAction<Site | null>>
}

/** Refresh only billing under RLS, even while full-site/navigation refreshes are paused. */
export async function refreshSiteBillingRecord(siteId: string, deps: BillingRefreshDeps): Promise<void> {
  if (siteId.startsWith("demo-")) return
  const controller = new AbortController()
  const supabase = createClient()
  try {
    const { data, error } = await withTimeout<{
      data: NonNullable<Site["billing"]> | null; error: unknown
    }>(readSiteBilling<NonNullable<Site['billing']>>(fields => supabase
      .from("billing").select(fields).eq("site_id", siteId)
      .abortSignal(controller.signal).single()),
    BILLING_READ_TIMEOUT_MS, "The latest billing information could not be loaded")
    if (error || !data) throw new Error("The latest billing information could not be loaded")
    const billing = hydrateSiteBilling(data)
    markBillingRefreshed(billing)
    const apply = (site: Site): Site => site.id === siteId ? { ...site, billing, billing_read_status: 'loaded' } : site
    deps.setSites(previous => previous.map(apply))
    deps.setCurrentSite(previous => previous ? apply(previous) : previous)
  } finally {
    // Also stop the HTTP read; a late response cannot update state after the deadline.
    controller.abort()
  }
}