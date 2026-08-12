"use client"

import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"

export type PromotionStatus = "draft" | "active" | "paused" | "expired"

const PROMOTION_STATUSES: {
  id: PromotionStatus
  labelKey: string
  fallback: string
}[] = [
  { id: "draft", labelKey: "promotions.detail.status.draft", fallback: "Draft" },
  { id: "active", labelKey: "promotions.detail.status.active", fallback: "Active" },
  { id: "paused", labelKey: "promotions.detail.status.paused", fallback: "Paused" },
  { id: "expired", labelKey: "promotions.detail.status.expired", fallback: "Expired" },
]

const STATUS_STYLES: Record<PromotionStatus, string> = {
  draft: "bg-muted text-foreground hover:bg-muted/80 border-border",
  active: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  paused: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  expired: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

interface PromotionStatusBarProps {
  currentStatus: PromotionStatus
  onStatusChange: (status: PromotionStatus) => void
  disabled?: boolean
}

export function PromotionStatusBar({
  currentStatus,
  onStatusChange,
  disabled,
}: PromotionStatusBarProps) {
  const { t } = useLocalization()

  return (
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {PROMOTION_STATUSES.map((status) => (
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
            {t(status.labelKey) || status.fallback}
          </Badge>
        ))}
      </div>
    </div>
  )
}
