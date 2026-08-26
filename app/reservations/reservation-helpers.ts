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

type ServiceColorReservation = Pick<
  Reservation,
  "catalog_item_id" | "location_id" | "assignee_user_id" | "resource_type" | "catalog_item" | "location"
>

export const RESERVATION_SERVICE_COLORS = [
  {
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    swatch: "bg-violet-500",
  },
  {
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    swatch: "bg-sky-500",
  },
  {
    badge: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    swatch: "bg-teal-500",
  },
  {
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    swatch: "bg-orange-500",
  },
  {
    badge: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20",
    swatch: "bg-fuchsia-500",
  },
  {
    badge: "bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/20",
    swatch: "bg-lime-500",
  },
  {
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    swatch: "bg-indigo-500",
  },
  {
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    swatch: "bg-rose-500",
  },
  {
    badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
    swatch: "bg-cyan-500",
  },
  {
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    swatch: "bg-purple-500",
  },
  {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    swatch: "bg-amber-500",
  },
  {
    badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
    swatch: "bg-pink-500",
  },
] as const

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function reservationServiceColorKey(reservation: ServiceColorReservation) {
  if (reservation.catalog_item_id) return `catalog:${reservation.catalog_item_id}`
  if (reservation.location_id) return `location:${reservation.location_id}`
  if (reservation.assignee_user_id) return `employee:${reservation.assignee_user_id}`
  const name = reservation.catalog_item?.name || reservation.location?.name
  if (name) return `name:${name}`
  return `type:${reservation.resource_type || "unknown"}`
}

export function reservationServiceColor(reservation: ServiceColorReservation) {
  const index = hashString(reservationServiceColorKey(reservation)) % RESERVATION_SERVICE_COLORS.length
  return RESERVATION_SERVICE_COLORS[index]
}
