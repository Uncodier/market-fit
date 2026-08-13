"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { listReservationSchedules, deleteReservationSchedule } from "../schedule-actions"
import { ReservationSchedule } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CalendarIcon, Edit, Trash2 } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { ScheduleEditorDialog } from "./ScheduleEditorDialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

function getEnabledDays(days: any) {
  if (!days) return "None"
  const labels = Object.entries(days)
    .filter(([, config]: any) => config?.enabled)
    .map(([day]) => DAY_LABELS[day] || (day.charAt(0).toUpperCase() + day.slice(1, 3)))
  return labels.length > 0 ? labels.join(" · ") : "None"
}

export function SchedulesList({ siteId }: { siteId: string }) {
  const { t } = useLocalization()
  const [editingSchedule, setEditingSchedule] = useState<Partial<ReservationSchedule> | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null)

  const { data, mutate } = useSWR(
    ["reservation_schedules", siteId],
    () => listReservationSchedules(siteId)
  )

  const schedules = data?.data || []

  const confirmDelete = async () => {
    if (!deletingScheduleId) return
    const { error } = await deleteReservationSchedule(deletingScheduleId)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("reservations.schedules.deleted") || "Schedule deleted")
      mutate()
    }
    setDeletingScheduleId(null)
  }

  return (
    <>
      {schedules.length === 0 ? (
        <EmptyCard
          icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
          title={t("reservations.schedules.empty.title") || "No schedules found"}
          description={t("reservations.schedules.empty.description") || "Enable Reservable on a catalog item to configure its schedule."}
        />
      ) : (
        <div className={documentListShellClassName()}>
          <Table className="min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <TableRow className="hover:bg-transparent">
                <DocumentListHead className="w-[32%]">{t("reservations.schedules.service") || "Service"}</DocumentListHead>
                <DocumentListHead className="w-[22%]">{t("reservations.schedules.days") || "Days"}</DocumentListHead>
                <DocumentListHead className="w-[16%]">{t("reservations.schedules.duration") || "Duration"}</DocumentListHead>
                <DocumentListHead className="w-[16%]" align="right">{t("reservations.schedules.capacity") || "Capacity"}</DocumentListHead>
                <DocumentListHead className="w-[14%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule: any) => (
                <DocumentListRow key={schedule.id} className="cursor-default" accent="none">
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={schedule.catalog_item?.name || (t("reservations.schedules.unknown") || "Unknown service")}
                      secondary={schedule.name || (t("reservations.schedules.default") || "Default")}
                      secondaryMono={false}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {getEnabledDays(schedule.days)}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {schedule.duration_minutes} {t("reservations.schedules.min") || "min"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex justify-end">
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                        {schedule.capacity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        setEditingSchedule(schedule)
                        setIsEditorOpen(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setDeletingScheduleId(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </DocumentListRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ScheduleEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        schedule={editingSchedule}
        onSaved={mutate}
      />

      <AlertDialog open={!!deletingScheduleId} onOpenChange={(open) => !open && setDeletingScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reservations.schedules.deleteTitle") || "Are you sure you want to delete this schedule?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reservations.schedules.deleteDescription") || "This action cannot be undone. This will permanently delete the reservation schedule."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
