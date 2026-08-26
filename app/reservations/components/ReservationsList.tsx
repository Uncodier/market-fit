"use client"

import React, { useState } from "react"
import { Reservation } from "@/app/types"
import { updateReservationStatus } from "../actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  ReservationDataRow,
  ReservationGroupHeader,
  ReservationsEmpty,
  ReservationsTableFrame,
} from "./reservation-table"
import { sortReservationGroups, type ReservationSortBy } from "../reservation-helpers"

interface ReservationsListProps {
  reservations: Reservation[]
  sortBy: ReservationSortBy
  siteId: string
  onUpdate: () => void
  onEdit: (reservation: Reservation) => void
}

export function ReservationsList({ reservations, sortBy, siteId, onUpdate, onEdit }: ReservationsListProps) {
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

  const grouped = sortReservationGroups(
    Object.entries(
      reservations.reduce((acc, res) => {
        const type = res.resource_type || "catalog_item"
        const serviceName =
          type === "location"
            ? (res.location?.name || t("visits.resource.locationFallback"))
            : type === "employee"
              ? t("visits.resource.teamFallback")
              : (res.catalog_item?.name || t("reservations.resource.unknownService"))
        if (!acc[serviceName]) acc[serviceName] = []
        acc[serviceName].push(res)
        return acc
      }, {} as Record<string, Reservation[]>)
    ),
    sortBy
  )

  if (reservations.length === 0) {
    return <ReservationsEmpty />
  }

  return (
    <ReservationsTableFrame count={reservations.length}>
      {grouped.map(([serviceName, resList]) => (
        <React.Fragment key={serviceName}>
          <ReservationGroupHeader title={serviceName} count={resList.length} />
          {resList.map((reservation) => (
            <ReservationDataRow
              key={reservation.id}
              reservation={reservation}
              siteId={siteId}
              updating={updating === reservation.id}
              onStatusChange={handleStatusChange}
              onEdit={onEdit}
            />
          ))}
        </React.Fragment>
      ))}
    </ReservationsTableFrame>
  )
}
