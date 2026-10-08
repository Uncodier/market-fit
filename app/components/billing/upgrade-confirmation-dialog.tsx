"use client"

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog"
import { Button } from "../ui/button"

export function UpgradeConfirmationDialog({ open, onClose, onConfirm, busy }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  return <AlertDialog open={open} onOpenChange={value => { if (!value && !busy) onClose() }}>
    <AlertDialogContent busy={busy}>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirm immediate upgrade</AlertDialogTitle>
        <AlertDialogDescription>
          Stripe will charge the new billing period now and apply a proportional credit for
          unused time on your current plan. Your billing renewal date will reset to today.
          Your new plan becomes available only after payment is confirmed. If payment
          requires further action, your current plan remains active until it succeeds.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Keep current plan</AlertDialogCancel>
        <Button type="button" disabled={busy} onClick={onConfirm}>Confirm and pay</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}