"use client"

import type { Dispatch, SetStateAction } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Site } from "./site-types"
import { withTimeout } from "@/app/services/request-timeout"
import { markBillingRefreshed } from "./site-billing-freshness"
import { hydrateSiteBilling } from "./site-billing-data"
import { readSiteBilling } from "./read-site-billing"
import { snapshotPostgrestError } from "@/lib/supabase/postgrest-error"

export const BILLING_READ_TIMEOUT_MS = 8_000

type BillingRefreshDeps = {
  setSites: Dispatch<SetStateAction<Site[]>>
  setCurrentSite: Dispatch<SetStateAction<Site | null>>
}

type RefreshRequest = { siteId: string; current: boolean }
// Completed reads can still have queued React setters. Keep their tokens weakly,
// not a permanent per-site map, and invalidate them even when the newer read fails.
const requests = new Set<WeakRef<RefreshRequest>>()
const collectedRequests = new FinalizationRegistry<WeakRef<RefreshRequest>>(ref => requests.delete(ref))

function beginRequest(siteId: string): RefreshRequest {
  for (const ref of requests) {
    const previous = ref.deref()
    if (!previous || previous.siteId === siteId) {
      if (previous) previous.current = false
      requests.delete(ref)
      collectedRequests.unregister(ref)
    }
  }
  const request = { siteId, current: true }
  const ref = new WeakRef(request)
  requests.add(ref)
  collectedRequests.register(request, ref, ref)
  return request
}

async function readBilling(siteId: string, signal: AbortSignal) {
  const supabase = createClient()
  const { data, error } = await readSiteBilling<NonNullable<Site['billing']>>(fields => supabase
    .from("billing").select(fields).eq("site_id", siteId).abortSignal(signal).single())
  if (!error && data) return hydrateSiteBilling(data)
  // RLS emptiness (including PGRST116) is not proof that setup is needed.
  if (error && snapshotPostgrestError(error).code !== 'PGRST116') throw new Error("The latest billing information could not be loaded")
  if (signal.aborted) throw new Error("The latest billing information could not be loaded")
  const response = await fetch(`/api/billing/presence?site_id=${encodeURIComponent(siteId)}`, {
    credentials: 'include', cache: 'no-store', signal,
  })
  if (!response.ok || (await response.json())?.status !== 'missing') {
    throw new Error("The latest billing information could not be loaded")
  }
  return undefined
}

/** Refresh RLS balances; only an authorized server read may confirm absence. */
export async function refreshSiteBillingRecord(siteId: string, deps: BillingRefreshDeps): Promise<void> {
  if (siteId.startsWith("demo-")) return
  const request = beginRequest(siteId)
  const controller = new AbortController()
  try {
    const billing = await withTimeout(readBilling(siteId, controller.signal),
    BILLING_READ_TIMEOUT_MS, "The latest billing information could not be loaded")
    if (!request.current) return
    if (billing) markBillingRefreshed(billing)
    const apply = (site: Site): Site => site.id === siteId
      ? { ...site, billing, billing_read_status: billing ? 'loaded' : 'missing' } : site
    deps.setSites(previous => request.current ? previous.map(apply) : previous)
    deps.setCurrentSite(previous => request.current && previous ? apply(previous) : previous)
  } finally {
    // Also stop the HTTP read; a late response cannot update state after the deadline.
    controller.abort()
  }
}