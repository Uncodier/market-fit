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
  if (previous.id !== incoming.id || !previous.billing) return incoming
  return { ...incoming, billing: previous.billing }
}

/** Full loads may replace billing unless a targeted read completed after they began. */
export function mergeLoadedSiteBilling(previous: Site[], incoming: Site[], startedAt: number): Site[] {
  const existing = new Map(previous.map(site => [site.id, site]))
  return incoming.map(site => {
    const current = existing.get(site.id)
    return current?.billing && (billingRevisions.get(current.billing) ?? 0) > startedAt
      ? preserveHydratedBilling(current, site) : site
  })
}