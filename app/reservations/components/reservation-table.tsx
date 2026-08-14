"use client"

import React from "react"
import { format } from "date-fns"
import { Reservation } from "@/app/types"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Calendar as CalendarIcon } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { ReservationAttestationCell } from "./ReservationAttestationCell"
import { ReservationCustomerCell } from "./ReservationCustomerCell"
import { ReservationRowActions } from "./ReservationRowActions"
import { reservationCanEdit } from "../reservation-helpers"

export function reservationAccent(status: Reservation["status"]): "due" | "cancelled" | "none" {
  if (status === "cancelled") return "cancelled"
  if (status === "pending") return "due"
  return "none"
}

export function ReservationTimeCell({
  start,
  end,
  showDate = true,
}: {
  start: string
  end: string
  showDate?: boolean
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[15px] font-semibold tabular-nums tracking-tight whitespace-nowrap">
        {format(new Date(start), "h:mm a")} – {format(new Date(end), "h:mm a")}
      </span>
      {showDate ? (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {format(new Date(start), "MMM d, yyyy")}
        </span>
      ) : null}
    </div>
  )
}

export function ReservationGroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={5} className="bg-muted/30 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">{count}</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ReservationDataRow({
  reservation,
  siteId,
  updating,
  onStatusChange,
  onEdit,
  customerMeta,
  showDate,
}: {
  reservation: Reservation
  siteId: string
  updating: boolean
  onStatusChange: (id: string, status: Reservation["status"]) => void
  onEdit?: (reservation: Reservation) => void
  customerMeta?: string | null
  showDate?: boolean
}) {
  const { t } = useLocalization()
  const statusLabel = t(`reservations.status.${reservation.status}`) || reservation.status
  const canEdit = Boolean(onEdit) && reservationCanEdit(reservation)

  return (
    <DocumentListRow
      accent={reservationAccent(reservation.status)}
      onClick={canEdit ? () => onEdit?.(reservation) : undefined}
      className={canEdit ? undefined : "cursor-default"}
    >
      <TableCell className="py-3.5">
        <ReservationCustomerCell reservation={reservation} siteId={siteId} meta={customerMeta} />
      </TableCell>
      <TableCell className="py-3.5">
        <StatusDot status={reservation.status} label={statusLabel} />
      </TableCell>
      <TableCell className="py-3.5">
        <ReservationTimeCell start={reservation.start_time} end={reservation.end_time} showDate={showDate} />
      </TableCell>
      <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
        <ReservationAttestationCell reservation={reservation} siteId={siteId} />
      </TableCell>
      <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
        <ReservationRowActions
          reservation={reservation}
          siteId={siteId}
          updating={updating}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
        />
      </TableCell>
    </DocumentListRow>
  )
}

export function ReservationsTableFrame({
  children,
  count,
}: {
  children: React.ReactNode
  count: number
}) {
  const { t } = useLocalization()

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[820px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[32%]">{t("reservations.table.customer") || "Customer"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("reservations.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("reservations.table.time") || "Time"}</DocumentListHead>
            <DocumentListHead className="w-[22%]">{t("reservations.table.attestation") || "Attestation"}</DocumentListHead>
            <DocumentListHead className="w-[12%]" align="right">{t("reservations.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{count}</span>
          {" "}
          {t("reservations.table.reservations") || "reservations"}
        </p>
      </div>
    </div>
  )
}

export function ReservationsEmpty() {
  const { t } = useLocalization()
  return (
    <EmptyCard
      icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
      title={t("reservations.empty.title") || "No reservations found"}
      description={t("reservations.empty.description") || "When customers book your services, they will appear here."}
    />
  )
}

export function ReservationsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 2 || index === 4 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", (index === 2 || index === 4) && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
