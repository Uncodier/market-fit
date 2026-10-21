import { locationAccessSchema } from './location-access'

/** A permission fingerprint is a freshness signal, never a cached authorization grant. */
export function locationPermissionRevision(data: unknown, siteId: string): string | null {
  if (data === null) return 'unavailable'
  const parsed = locationAccessSchema.safeParse(data)
  if (!parsed.success || parsed.data.site_id.toLowerCase() !== siteId.toLowerCase()) return null
  return JSON.stringify([parsed.data.role, parsed.data.revision,
    parsed.data.restricted_location_ids.map(id => id.toLowerCase()).sort()])
}