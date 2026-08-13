import { redirect } from "next/navigation"

export default function AdminNewReservationRedirect() {
  redirect("/reservations")
}
