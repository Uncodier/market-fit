"use client"

import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"

export function ReservationDialogConfirmations(props: {
  discardOpen: boolean
  setDiscardOpen: (open: boolean) => void
  confirmDiscard: () => void
  cancelOpen: boolean
  setCancelOpen: (open: boolean) => void
  cancelling: boolean
  cancel: () => Promise<void>
  t: (key: string) => string
}) {
  const { t } = props
  return <>
    <ConfirmDialog open={props.discardOpen} onOpenChange={props.setDiscardOpen}
      title={t("reservations.dialog.discardTitle") || "Discard changes?"}
      description={t("reservations.dialog.discardDescription") || "Your changes will be lost."}
      confirmLabel={t("reservations.dialog.discard") || "Discard"} variant="destructive"
      onConfirm={props.confirmDiscard} dataPermission="allow" />
    <ConfirmDialog open={props.cancelOpen} onOpenChange={props.setCancelOpen}
      title={t("reservations.dialog.cancelConfirmTitle") || "Cancel this reservation?"}
      description={t("reservations.dialog.cancelConfirmDescription") || "The time slot will become available again."}
      confirmLabel={t("reservations.dialog.cancelReservation") || "Cancel reservation"}
      variant="destructive" loading={props.cancelling} onConfirm={props.cancel} dataPermission="allow" />
  </>
}