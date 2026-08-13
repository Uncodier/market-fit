"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useLocalization } from "@/app/context/LocalizationContext"

type SaleStatus = "pending" | "completed" | "cancelled" | "refunded"

const FORWARD_PATH: SaleStatus[] = ["pending", "completed"]
const OUTCOMES: SaleStatus[] = ["cancelled", "refunded"]

const STATUS_STYLES: Record<SaleStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
}

const STATUS_KEYS: Record<SaleStatus, { key: string; fallback: string }> = {
  pending: { key: "sales.status.pending", fallback: "Pending" },
  completed: { key: "sales.status.completed", fallback: "Completed" },
  cancelled: { key: "sales.status.cancelled", fallback: "Cancelled" },
  refunded: { key: "sales.status.refunded", fallback: "Refunded" },
}

interface StatusBarProps {
  currentStatus: SaleStatus
  onStatusChange: (status: SaleStatus) => void
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
