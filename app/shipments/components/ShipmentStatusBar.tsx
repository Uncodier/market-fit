"use client"

import { useState } from "react"
import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { VALID_STATUS_TRANSITIONS } from "../tracking"
import type { ShipmentWithRelations } from "../types"

type Status = ShipmentWithRelations["status"]
const FORWARD_PATH: Status[] = ["pending", "preparing", "shipped", "in_transit"]
const OUTCOMES: Status[] = ["delivered", "failed", "cancelled"]
export const SHIPMENT_STATUS_LABELS: Record<Status, string> = {
  pending: "Pending", preparing: "Preparing", shipped: "Shipped", in_transit: "In transit",
  delivered: "Delivered", failed: "Failed", cancelled: "Cancelled",
}
const STYLES: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  preparing: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  shipped: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  in_transit: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
}

export function ShipmentStatusBar({ currentStatus, onStatusChange, disabled = false }: {
  currentStatus: Status
  onStatusChange: (status: Status) => void
  disabled?: boolean
}) {
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null)
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || []
  const selectStatus = (status: Status) => {
    if (disabled || !allowed.includes(status)) return
    if (OUTCOMES.includes(status)) setPendingStatus(status)
    else onStatusChange(status)
  }

  return (
    <>
      <ProgressiveStatusBar
        current={currentStatus}
        forwardPath={FORWARD_PATH}
        outcomes={OUTCOMES}
        successOutcomes={["delivered"]}
        styles={STYLES}
        labels={SHIPMENT_STATUS_LABELS}
        onChange={selectStatus}
        disabled={disabled}
        disabledStatuses={[...FORWARD_PATH, ...OUTCOMES].filter((status) => !allowed.includes(status))}
      />
      <AlertDialog open={Boolean(pendingStatus)} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark shipment as {pendingStatus ? SHIPMENT_STATUS_LABELS[pendingStatus].toLowerCase() : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the fulfillment status. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={disabled} onClick={() => {
              if (pendingStatus && !disabled && allowed.includes(pendingStatus)) onStatusChange(pendingStatus)
              setPendingStatus(null)
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}