"use client"

import { Button } from "@/app/components/ui/button"
import { DialogFooter } from "@/app/components/ui/dialog"
import { Banknote } from "@/app/components/ui/icons"

export function ReservationDialogFooter({
  canCancel,
  canRegisterPayment,
  onCancelReservation,
  onRegisterPayment,
  onClose,
  onSubmit,
  isBusy,
  isSubmitting,
  isEdit,
  serviceDisabled,
  t,
}: {
  canCancel: boolean
  canRegisterPayment: boolean
  onCancelReservation: () => void
  onRegisterPayment?: () => void
  onClose: () => void
  onSubmit: () => void
  isBusy: boolean
  isSubmitting: boolean
  isEdit: boolean
  serviceDisabled: boolean
  t: (key: string) => string
}) {
  return (
    <DialogFooter className="gap-2 sm:justify-between">
      <div className="flex gap-2">
        {canCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onCancelReservation}
            disabled={isBusy}
          >
            {t("reservations.dialog.cancelReservation") || "Cancel reservation"}
          </Button>
        ) : null}
        {canRegisterPayment && onRegisterPayment ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRegisterPayment}
            disabled={isBusy}
          >
            <Banknote className="h-4 w-4 mr-2" />
            {t("reservations.actions.registerPayment") || "Register payment"}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
          {t("common.cancel") || "Cancel"}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isBusy || serviceDisabled}>
          {isSubmitting
            ? isEdit
              ? t("reservations.dialog.saving") || "Saving..."
              : t("reservations.dialog.creating") || "Creating..."
            : isEdit
              ? t("reservations.dialog.save") || "Save changes"
              : t("reservations.dialog.createTitle") || "Create reservation"}
        </Button>
      </div>
    </DialogFooter>
  )
}
