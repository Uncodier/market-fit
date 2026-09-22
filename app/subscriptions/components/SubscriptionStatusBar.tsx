"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import type { Subscription } from "@/app/types"

type SubscriptionStatus = Subscription["status"]

const FORWARD_PATH: SubscriptionStatus[] = ["active", "paused"]
const OUTCOMES: SubscriptionStatus[] = ["cancelled", "expired"]

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
  paused: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200 border border-red-200",
  expired: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200",
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  expired: "Expired",
}

export function SubscriptionStatusBar({
  currentStatus,
  onStatusChange,
  disabled,
}: {
  currentStatus: SubscriptionStatus
  onStatusChange: (status: SubscriptionStatus) => void
  disabled?: boolean
}) {
  return (
    <ProgressiveStatusBar
      current={currentStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={STATUS_LABELS}
      onChange={onStatusChange}
      disabled={disabled}
    />
  )
}
