import type { Reservation } from "@/app/types"

export function reservationCanEdit(reservation: Pick<Reservation, "status">) {
  return reservation.status === "pending" || reservation.status === "confirmed"
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
