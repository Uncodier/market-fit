"use client"

import React, { useState } from "react"
import { CalendarBlock, Reservation } from "@/app/types"
import { updateReservationStatus } from "../actions"
import { deleteCalendarBlock } from "../calendar-blocks-actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { reservationResourceLabel } from "@/app/visits/visit-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  CalendarBlockDataRow,
  ReservationDataRow,
  ReservationGroupHeader,
  ReservationsEmpty,
  ReservationsTableFrame,
} from "./reservation-table"
import { type ReservationSortBy } from "../reservation-helpers"
import { groupTimelineByLocalDate } from "../calendar-block-helpers"

interface ReservationsByDateListProps {
  reservations: Reservation[]
  blocks?: CalendarBlock[]
  sortBy: ReservationSortBy
  siteId: string
  onUpdate: () => void
  onEdit: (reservation: Reservation) => void
  onEditBlock?: (block: CalendarBlock) => void
  onRegisterPayment?: (reservation: Reservation) => void
}

export function ReservationsByDateList({
  reservations,
  blocks = [],
  sortBy,
  siteId,
  onUpdate,
  onEdit,
  onEditBlock,
  onRegisterPayment,
}: ReservationsByDateListProps) {
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
      toast.success(t("reservations.toast.blockRemoved") || "Block removed")
      onUpdate()
    }
    setUpdating(null)
  }

  const grouped = groupTimelineByLocalDate(reservations, blocks, sortBy)

  if (reservations.length === 0 && blocks.length === 0) {
    return <ReservationsEmpty />
  }

  return (
    <ReservationsTableFrame count={reservations.length} blocksCount={blocks.length}>
      {grouped.map(([dayStr, items]) => {
        const dateObj = new Date(items[0].start_time)
        return (
          <React.Fragment key={dayStr}>
            <ReservationGroupHeader title={format(dateObj, "EEEE, MMMM d, yyyy")} count={items.length} />
            {items.map((item) =>
              item.kind === "block" ? (
                <CalendarBlockDataRow
                  key={item.id}
                  block={item.block}
                  onEdit={onEditBlock}
                  onDelete={handleDeleteBlock}
                  deleting={updating === item.id}
                  showDate={false}
                />
              ) : (
                <ReservationDataRow
                  key={item.id}
                  reservation={item.reservation}
                  siteId={siteId}
                  updating={updating === item.id}
                  onStatusChange={handleStatusChange}
                  onEdit={onEdit}
                  onRegisterPayment={onRegisterPayment}
                  showDate={false}
                  customerMeta={reservationResourceLabel({
                    resource_type: item.reservation.resource_type,
                    catalog_item: item.reservation.catalog_item,
                    location: item.reservation.location,
                  })}
                />
              )
            )}
          </React.Fragment>
        )
      })}
    </ReservationsTableFrame>
  )
}
