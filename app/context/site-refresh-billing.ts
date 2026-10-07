"use client"

import type { Dispatch, SetStateAction } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Site } from "./site-types"
import { withTimeout } from "@/app/services/request-timeout"
import { markBillingRefreshed } from "./site-billing-freshness"

export const BILLING_READ_TIMEOUT_MS = 8_000

type BillingRefreshDeps = {
  setSites: Dispatch<SetStateAction<Site[]>>
  setCurrentSite: Dispatch<SetStateAction<Site | null>>
}

/** Refresh only billing under RLS, even while full-site/navigation refreshes are paused. */
export async function refreshSiteBillingRecord(siteId: string, deps: BillingRefreshDeps): Promise<void> {
  if (siteId.startsWith("demo-")) return
  const controller = new AbortController()
  const query = createClient()
    .from("billing")
    .select("plan, addons_count, masked_card_number, card_name, card_expiry, stripe_customer_id, stripe_payment_method_id, card_address, card_city, card_postal_code, card_country, tax_id, billing_address, billing_city, billing_postal_code, billing_country, auto_renew, credits_available, credits_used, account_balance, plan_credits_available, purchased_credits_available, legacy_credits_available, plan_credit_period_start, plan_credit_period_end, plan_credit_allowance, monthly_credits_used, plan_credits_used, plan_credit_source")
    .eq("site_id", siteId)
    .abortSignal(controller.signal)
    .single()
  try {
    const { data, error } = await withTimeout<{
      data: NonNullable<Site["billing"]> | null; error: unknown
    }>(query, BILLING_READ_TIMEOUT_MS, "The latest billing information could not be loaded")
    if (error || !data) throw new Error("The latest billing information could not be loaded")
    const billing = { ...data, auto_renew: data.auto_renew ?? true } as NonNullable<Site["billing"]>
    markBillingRefreshed(billing)
    const apply = (site: Site): Site => site.id === siteId ? { ...site, billing } : site
    deps.setSites(previous => previous.map(apply))
    deps.setCurrentSite(previous => previous ? apply(previous) : previous)
  } finally {
    // Also stop the HTTP read; a late response cannot update state after the deadline.
    controller.abort()
  }
}