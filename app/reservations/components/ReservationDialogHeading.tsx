import { DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"

export function ReservationDialogHeading({ isEdit, isTask, t }: {
  isEdit: boolean
  isTask?: boolean
  t: (key: string) => string
}) {
  return (
    <DialogHeader>
      <DialogTitle>
        {isEdit
          ? (isTask ? t("reservations.task.editTitle") || "Edit Task" : t("reservations.dialog.editTitle") || "Edit reservation")
          : t("reservations.dialog.createTitle") || "Create reservation"}
      </DialogTitle>
      <DialogDescription>
        {isEdit
          ? (isTask ? t("reservations.task.editDescription") || "Update the task details." : t("reservations.dialog.editDescription") || "Update the service, customer, time slot, or notes.")
          : t("reservations.dialog.createDescription") || "Book a reservable service for a customer."}
      </DialogDescription>
    </DialogHeader>
  )
}