"use client"

import React from "react"
import { format } from "date-fns"
import { Reservation, CalendarBlock } from "@/app/types"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Calendar as CalendarIcon, Ban, MoreHorizontal, Pencil, Trash2 } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
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
import { calendarBlockLocalDateKey, calendarBlockScopeLabel, calendarBlockTitle } from "../calendar-block-helpers"

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

export function CalendarBlockDataRow({
  block,
  onEdit,
  onDelete,
  deleting,
  showDate,
}: {
  block: CalendarBlock
  onEdit?: (block: CalendarBlock) => void
  onDelete?: (block: CalendarBlock) => void
  deleting?: boolean
  showDate?: boolean
}) {
  const title = calendarBlockTitle(block)
  const scope = calendarBlockScopeLabel(block)
  const spansDays =
    calendarBlockLocalDateKey(block.start_time) !==
    calendarBlockLocalDateKey(new Date(new Date(block.end_time).getTime() - 1))

  return (
    <DocumentListRow
      accent="none"
      onClick={onEdit ? () => onEdit(block) : undefined}
      className={onEdit ? undefined : "cursor-default"}
    >
      <TableCell className="py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
            <Ban className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium leading-tight text-foreground">{title}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{scope}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3.5">
        <StatusDot status="blocked" label="Blocked" />
      </TableCell>
      <TableCell className="py-3.5">
        <ReservationTimeCell start={block.start_time} end={block.end_time} showDate={showDate || spansDays} />
      </TableCell>
      <TableCell className="py-3.5">
        <span className="text-sm text-muted-foreground">—</span>
      </TableCell>
      <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              disabled={deleting}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit ? (
              <DropdownMenuItem onClick={() => onEdit(block)}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                onClick={() => onDelete(block)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </DocumentListRow>
  )
}

export function ReservationsTableFrame({
  children,
  count,
  blocksCount = 0,
}: {
  children: React.ReactNode
  count: number
  blocksCount?: number
}) {
  const { t } = useLocalization()
  const reservationLabel = t("reservations.table.reservations") || "reservations"
  const blockLabel = blocksCount === 1 ? "block" : "blocks"

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
          {reservationLabel}
          {blocksCount > 0 ? (
            <>
              {" · "}
              <span className="font-medium text-foreground">{blocksCount}</span>
              {" "}
              {blockLabel}
            </>
          ) : null}
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
