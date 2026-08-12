import { getBuyerReservation } from "@/app/buyer/reservation-actions"
import { notFound } from "next/navigation"
import { getScheduleByCatalogItem } from "@/app/reservations/schedule-actions"
import { ServicePdpLayout } from "@/app/components/commerce/pdp/ServicePdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"

export default async function ReservationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { data: reservation, error } = await getBuyerReservation(params.id)

  if (error || !reservation?.catalog_item) {
    return notFound()
  }

  let schedules: any[] = []
  if (reservation.status === "pending" || reservation.status === "confirmed") {
    const { data } = await getScheduleByCatalogItem(reservation.catalog_item_id)
    if (data?.length) {
      schedules = data
    } else if (reservation.catalog_item?.parent_id || reservation.catalog_item?._parent?.id) {
      const parentId = reservation.catalog_item.parent_id || reservation.catalog_item._parent.id
      const { data: parentSchedules } = await getScheduleByCatalogItem(parentId)
      if (parentSchedules) schedules = parentSchedules
    }
  }

  const backUrl = "/buyer"
  const experience: PdpExperience = {
    kind: "reservation",
    backUrl,
    reservation,
    extras: { schedules },
  }

  return (
    <BuyerExperienceShell backUrl={backUrl} variant="reservation">
      <ServicePdpLayout
        item={reservation.catalog_item}
        backUrl={backUrl}
        experience={experience}
      />
    </BuyerExperienceShell>
  )
}
