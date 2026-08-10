"use client"

import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"

const ORDER_STATUSES = [
  { id: "pending" as const, key: "orders.status.pending", fallback: "Pending" },
  { id: "in_progress" as const, key: "orders.status.in_progress", fallback: "In Progress" },
  { id: "completed" as const, key: "orders.status.completed", fallback: "Completed" },
  { id: "cancelled" as const, key: "orders.status.cancelled", fallback: "Cancelled" },
]

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

export type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled"

interface OrderStatusBarProps {
  currentStatus: string
  onStatusChange: (status: OrderStatus) => void
  disabled?: boolean
}

export function OrderStatusBar({ currentStatus, onStatusChange, disabled }: OrderStatusBarProps) {
  const { t } = useLocalization()

  return (
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {ORDER_STATUSES.map((status) => (
          <Badge
            key={status.id}
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentStatus === status.id
                ? STATUS_STYLES[status.id]
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
            onClick={() => {
              if (!disabled && currentStatus !== status.id) {
                onStatusChange(status.id)
              }
            }}
          >
            {t(status.key) || status.fallback}
          </Badge>
        ))}
      </div>
    </div>
  )
}
