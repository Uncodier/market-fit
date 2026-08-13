"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useLocalization } from "@/app/context/LocalizationContext"

export type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled"

const FORWARD_PATH: OrderStatus[] = ["pending", "in_progress", "completed"]
const OUTCOMES: OrderStatus[] = ["cancelled"]

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

const STATUS_KEYS: Record<OrderStatus, { key: string; fallback: string }> = {
  pending: { key: "orders.status.pending", fallback: "Pending" },
  in_progress: { key: "orders.status.in_progress", fallback: "In Progress" },
  completed: { key: "orders.status.completed", fallback: "Completed" },
  cancelled: { key: "orders.status.cancelled", fallback: "Cancelled" },
}

interface OrderStatusBarProps {
  currentStatus: string
  onStatusChange: (status: OrderStatus) => void
  disabled?: boolean
}

export function OrderStatusBar({ currentStatus, onStatusChange, disabled }: OrderStatusBarProps) {
  const { t } = useLocalization()

  return (
    <ProgressiveStatusBar
      current={currentStatus as OrderStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={(status) => t(STATUS_KEYS[status].key) || STATUS_KEYS[status].fallback}
      onChange={onStatusChange}
      disabled={disabled}
    />
  )
}
