"use client"

import { useState } from "react"
import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { CampaignStatus } from "@/app/types"
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

const FORWARD_PATH: CampaignStatus[] = ["pending", "active"]
const OUTCOMES: CampaignStatus[] = ["completed"]

export const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200",
  active: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
  completed: "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200",
}

const STATUS_NAMES: Record<CampaignStatus, string> = {
  pending: "Pending",
  active: "Active",
  completed: "Completed",
}

export function CampaignStatusBar({
  currentStatus,
  onStatusChange,
  className,
}: {
  currentStatus: CampaignStatus
  onStatusChange: (status: CampaignStatus) => void
  className?: string
}) {
  const [pendingComplete, setPendingComplete] = useState(false)

  const selectStatus = (status: CampaignStatus) => {
    if (status === "completed" && currentStatus !== "completed") {
      setPendingComplete(true)
      return
    }
    onStatusChange(status)
  }

  return (
    <>
      <ProgressiveStatusBar
        current={currentStatus}
        forwardPath={FORWARD_PATH}
        outcomes={OUTCOMES}
        successOutcomes={["completed"]}
        styles={CAMPAIGN_STATUS_STYLES}
        labels={STATUS_NAMES}
        onChange={selectStatus}
        className={className}
      />

      <AlertDialog open={pendingComplete} onOpenChange={setPendingComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the campaign as completed. All metrics and data will be final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onStatusChange("completed")
                setPendingComplete(false)
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Complete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
