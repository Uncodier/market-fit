"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useLocalization } from "@/app/context/LocalizationContext"

type PurchaseStatus = "draft" | "pending" | "completed" | "cancelled"

const FORWARD_PATH: PurchaseStatus[] = ["draft", "pending", "completed"]
const OUTCOMES: PurchaseStatus[] = ["cancelled"]

const STATUS_STYLES: Record<PurchaseStatus, string> = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

const STATUS_KEYS: Record<PurchaseStatus, { key: string; fallback: string }> = {
  draft: { key: "bills.status.draft", fallback: "Draft" },
  pending: { key: "bills.status.pending", fallback: "Pending" },
  completed: { key: "bills.status.completed", fallback: "Completed" },
  cancelled: { key: "bills.status.cancelled", fallback: "Cancelled" },
}

interface StatusBarProps {
  currentStatus: PurchaseStatus
  onStatusChange: (status: PurchaseStatus) => void
}

export function StatusBar({ currentStatus, onStatusChange }: StatusBarProps) {
  const { t } = useLocalization()

  return (
    <ProgressiveStatusBar
      current={currentStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={(status) => t(STATUS_KEYS[status].key) || STATUS_KEYS[status].fallback}
      onChange={onStatusChange}
    />
  )
}
