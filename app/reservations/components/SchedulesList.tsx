"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { listReservationSchedules, deleteReservationSchedule } from "../schedule-actions"
import { ReservationSchedule } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CalendarIcon, Edit, Trash2 } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { ScheduleEditorDialog } from "./ScheduleEditorDialog"
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

export function SchedulesList({ siteId }: { siteId: string }) {
  const [editingSchedule, setEditingSchedule] = useState<Partial<ReservationSchedule> | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR(
    ['reservation_schedules', siteId],
    () => listReservationSchedules(siteId)
  )

  const schedules = data?.data || []

  const confirmDelete = async () => {
    if (!deletingScheduleId) return
    const { error } = await deleteReservationSchedule(deletingScheduleId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Schedule deleted")
      mutate()
    }
    setDeletingScheduleId(null)
  }

  const getEnabledDays = (days: any) => {
    if (!days) return "None"
    return Object.entries(days)
      .filter(([_, config]: any) => config.enabled)
      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1, 3))
      .join(", ")
  }

  return (
    <>
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-medium">Reservation Schedules</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Schedule Name</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Days</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-48 text-center">
                <EmptyCard 
                  icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
                  title="No schedules found"
                  description="Enable 'Reservable' on a catalog item to configure its schedule."
                  className="border-0 shadow-none bg-transparent"
                />
              </TableCell>
            </TableRow>
          ) : (
            schedules.map((schedule: any) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">
                  {schedule.catalog_item?.name || "Unknown Service"}
                </TableCell>
                <TableCell>{schedule.name || "Default"}</TableCell>
                <TableCell>{schedule.duration_minutes} min</TableCell>
                <TableCell>{schedule.capacity}</TableCell>
                <TableCell>{getEnabledDays(schedule.days) || "None"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingSchedule(schedule)
                      setIsEditorOpen(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeletingScheduleId(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ScheduleEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        schedule={editingSchedule}
        onSaved={mutate}
      />

      <AlertDialog open={!!deletingScheduleId} onOpenChange={(open) => !open && setDeletingScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the reservation schedule and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
