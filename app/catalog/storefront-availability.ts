/**
 * Storefront listing availability: hide items merchants marked unavailable.
 * Matches POS (manual mode + status !== available). Always/inventory stay listed.
 */

export const STOREFRONT_AVAILABILITY_OR =
  "availability_mode.is.null,availability_mode.neq.manual,availability_status.eq.available"

export function isStorefrontAvailable(item: {
  availability_mode?: string | null
  availability_status?: string | null
}): boolean {
  return item.availability_mode !== "manual" || item.availability_status === "available"
}

export function applyStorefrontAvailability<T extends { or: (filter: string) => T }>(query: T): T {
  return query.or(STOREFRONT_AVAILABILITY_OR)
}
