/**
 * Storefront listing availability: hide items merchants marked unavailable.
 * Matches POS (manual mode + status !== available). Always/inventory stay listed.
 */

export const STOREFRONT_AVAILABILITY_OR =
  "availability_mode.is.null,availability_mode.neq.manual,availability_status.eq.available"

type AvailabilityItem = {
  id: string
  parent_id?: string | null
  availability_mode?: string | null
  availability_status?: string | null
}

export function isStorefrontAvailable(item: {
  availability_mode?: string | null
  availability_status?: string | null
}): boolean {
  return item.availability_mode !== "manual" || item.availability_status === "available"
}

/** Parent services shown in the reservation picker. Keeps the current item when editing. */
export function filterReservablePickerItems<T extends AvailabilityItem>(
  items: T[],
  currentItemId?: string | null,
): T[] {
  const current = currentItemId
    ? items.find((item) => item.id === currentItemId)
    : undefined
  const keepParentId = current?.parent_id || currentItemId || null

  return items.filter((item) => {
    if (item.parent_id) return false
    return isStorefrontAvailable(item) || item.id === keepParentId
  })
}

export function applyStorefrontAvailability<T extends { or: (filter: string) => T }>(query: T): T {
  return query.or(STOREFRONT_AVAILABILITY_OR)
}
