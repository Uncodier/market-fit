import type { Reservation } from "@/app/types"

export type ReservationSortBy = "newest" | "oldest"

export function reservationCanEdit(reservation: Pick<Reservation, "status">) {
  return reservation.status === "pending" || reservation.status === "confirmed"
}

export function compareReservationStartTime(
  a: Pick<Reservation, "start_time">,
  b: Pick<Reservation, "start_time">,
  sortBy: ReservationSortBy
) {
  const dateA = new Date(a.start_time).getTime()
  const dateB = new Date(b.start_time).getTime()
  return sortBy === "oldest" ? dateA - dateB : dateB - dateA
}

export function sortReservations<T extends Pick<Reservation, "start_time">>(
  reservations: T[],
  sortBy: ReservationSortBy
): T[] {
  return [...reservations].sort((a, b) => compareReservationStartTime(a, b, sortBy))
}

export function sortReservationGroups<T extends Pick<Reservation, "start_time">>(
  groups: [string, T[]][],
  sortBy: ReservationSortBy
): [string, T[]][] {
  return groups
    .map(([key, items]) => [key, sortReservations(items, sortBy)] as [string, T[]])
    .sort((a, b) => {
      const firstA = a[1][0]
      const firstB = b[1][0]
      if (!firstA || !firstB) return 0
      return compareReservationStartTime(firstA, firstB, sortBy)
    })
}

export function reservationCustomerName(reservation: Reservation, fallback = "Unknown customer") {
  return reservation.lead?.name || reservation.buyer_profile?.name || fallback
}

export function reservationServiceName(reservation: Reservation, fallback = "Unknown service") {
  return (
    reservation.catalog_item?.name ||
    reservation.location?.name ||
    (reservation.resource_type === "employee" ? "Employee" : fallback)
  )
}
