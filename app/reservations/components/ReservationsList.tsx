"use client"

import React, { useMemo, useState } from "react"
import { CalendarBlock, Reservation } from "@/app/types"
import { updateReservationStatus } from "../actions"
import { deleteCalendarBlock } from "../calendar-blocks-actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  CalendarBlockDataRow,
  ReservationDataRow,
  ReservationGroupHeader,
  ReservationsEmpty,
  ReservationsTableFrame,
} from "./reservation-table"
import { compareReservationStartTime, sortReservationGroups, sortReservations, type ReservationSortBy } from "../reservation-helpers"

interface ReservationsListProps {
  reservations: Reservation[]
  blocks?: CalendarBlock[]
  sortBy: ReservationSortBy
  siteId: string
  onUpdate: () => void
  onEdit: (reservation: Reservation) => void
  onEditBlock?: (block: CalendarBlock) => void
}

export function ReservationsList({
  reservations,
  blocks = [],
  sortBy,
  siteId,
  onUpdate,
  onEdit,
  onEditBlock,
}: ReservationsListProps) {
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

  const handleDeleteBlock = async (block: CalendarBlock) => {
    setUpdating(block.id)
    const { error } = await deleteCalendarBlock(block.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Block removed")
      onUpdate()
    }
    setUpdating(null)
  }

  const grouped = useMemo(() => {
    const reservationGroups = sortReservationGroups(
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
    ).map(([title, items]) => ({
      key: `service:${title}`,
      title,
      reservations: items,
      blocks: [] as CalendarBlock[],
    }))

    const groups = [...reservationGroups]
    if (blocks.length > 0) {
      groups.push({
        key: "blocked-time",
        title: "Blocked time",
        reservations: [],
        blocks: sortReservations(blocks, sortBy),
      })
      groups.sort((a, b) => {
        const firstA = a.reservations[0] || a.blocks[0]
        const firstB = b.reservations[0] || b.blocks[0]
        if (!firstA || !firstB) return 0
        return compareReservationStartTime(firstA, firstB, sortBy)
      })
    }

    return groups
  }, [reservations, blocks, sortBy, t])

  if (reservations.length === 0 && blocks.length === 0) {
    return <ReservationsEmpty />
  }

  return (
    <ReservationsTableFrame count={reservations.length} blocksCount={blocks.length}>
      {grouped.map((group) => (
        <React.Fragment key={group.key}>
          <ReservationGroupHeader
            title={group.title}
            count={group.reservations.length + group.blocks.length}
          />
          {group.blocks.map((item) => (
            <CalendarBlockDataRow
              key={item.id}
              block={item}
              onEdit={onEditBlock}
              onDelete={handleDeleteBlock}
              deleting={updating === item.id}
            />
          ))}
          {group.reservations.map((reservation) => (
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
