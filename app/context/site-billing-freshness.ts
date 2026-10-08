import type { Site } from "./site-types"

// Weak references do not retain financial data after its site leaves React state.
const billingRevisions = new WeakMap<NonNullable<Site["billing"]>, number>()
let revision = 0

export function captureBillingRevision(): number {
  return revision
}

export function markBillingRefreshed(billing: NonNullable<Site["billing"]>): void {
  billingRevisions.set(billing, ++revision)
}

/** A site/details hydration does not fetch billing and cannot replace its newer value. */
export function preserveHydratedBilling(previous: Site, incoming: Site): Site {
  if (previous.id !== incoming.id) return incoming
  return { ...incoming, billing: previous.billing, billing_read_status: previous.billing_read_status }
}

/** Full loads may replace billing unless a targeted read completed after they began. */
export function mergeLoadedSiteBilling(previous: Site[], incoming: Site[], startedAt: number): Site[] {
  const existing = new Map(previous.map(site => [site.id, site]))
  return incoming.map(site => {
    const current = existing.get(site.id)
    if (!current?.billing) return site
    if ((billingRevisions.get(current.billing) ?? 0) > startedAt) return preserveHydratedBilling(current, site)
    // A newer failed read preserves balances, but must still disable financial controls.
    return site.billing_read_status === 'unavailable' ? { ...site, billing: current.billing } : site
  })
}