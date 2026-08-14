"use client"

import React, { useState } from "react"
import { Reservation } from "@/app/types"
import { updateReservationStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { reservationResourceLabel } from "@/app/visits/visit-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  ReservationDataRow,
  ReservationGroupHeader,
  ReservationsEmpty,
  ReservationsTableFrame,
} from "./reservation-table"

interface ReservationsByDateListProps {
  reservations: Reservation[]
  siteId: string
  onUpdate: () => void
  onEdit: (reservation: Reservation) => void
}

export function ReservationsByDateList({ reservations, siteId, onUpdate, onEdit }: ReservationsByDateListProps) {
  const { t } = useLocalization()
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (id: string, status: Reservation["status"]) => {
    setUpdating(id)
    const { error } = await updateReservationStatus(siteId, id, status)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("reservations.toast.updated"))
      onUpdate()
    }
    setUpdating(null)
  }

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  const grouped = sorted.reduce((acc, res) => {
    const dayStr = format(new Date(res.start_time), "yyyy-MM-dd")
    if (!acc[dayStr]) acc[dayStr] = []
    acc[dayStr].push(res)
    return acc
  }, {} as Record<string, Reservation[]>)

  if (reservations.length === 0) {
    return <ReservationsEmpty />
  }

  return (
    <ReservationsTableFrame count={reservations.length}>
      {Object.entries(grouped).map(([dayStr, resList]) => {
        const dateObj = new Date(resList[0].start_time)
        return (
          <React.Fragment key={dayStr}>
            <ReservationGroupHeader title={format(dateObj, "EEEE, MMMM d, yyyy")} count={resList.length} />
            {resList.map((reservation) => (
              <ReservationDataRow
                key={reservation.id}
                reservation={reservation}
                siteId={siteId}
                updating={updating === reservation.id}
                onStatusChange={handleStatusChange}
                onEdit={onEdit}
                showDate={false}
                customerMeta={reservationResourceLabel({
                  resource_type: reservation.resource_type,
                  catalog_item: reservation.catalog_item,
                  location: reservation.location,
                })}
              />
            ))}
          </React.Fragment>
        )
      })}
    </ReservationsTableFrame>
  )
}
