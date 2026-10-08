"use client"

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog"
import { Button } from "../ui/button"
import { getMemberLimit, licensePlanLabel, type LicensePlan } from "@/lib/license-entitlements"

export function LicenseDowngradeDialog({ plan, onClose, onConfirm, busy }: {
  plan: LicensePlan | null
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const limit = plan ? getMemberLimit(plan) : null
  return <AlertDialog open={!!plan} onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent busy={busy}>
      <AlertDialogHeader>
        <AlertDialogTitle>Review license change</AlertDialogTitle>
        <AlertDialogDescription>
          {licensePlanLabel(plan)} includes {limit ?? ">10"} team members. After the plan change takes effect,
          the earliest added members and connections remain available within the new allowances.
          Later additions are suspended, not deleted. Upgrading restores license-suspended resources.
          Paid downgrades are scheduled at the end of your current billing period;
          your current plan stays active until then. Nothing is disconnected during review.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Keep current plan</AlertDialogCancel>
        <Button type="button" disabled={busy} onClick={onConfirm}>Confirm downgrade</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}