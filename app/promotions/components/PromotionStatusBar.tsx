"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useLocalization } from "@/app/context/LocalizationContext"

export type PromotionStatus = "draft" | "active" | "paused" | "expired"

const FORWARD_PATH: PromotionStatus[] = ["draft", "active"]
const OUTCOMES: PromotionStatus[] = ["paused", "expired"]

const STATUS_STYLES: Record<PromotionStatus, string> = {
  draft: "bg-muted text-foreground hover:bg-muted/80 border-border",
  active: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  paused: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  expired: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

const STATUS_KEYS: Record<PromotionStatus, { key: string; fallback: string }> = {
  draft: { key: "promotions.detail.status.draft", fallback: "Draft" },
  active: { key: "promotions.detail.status.active", fallback: "Active" },
  paused: { key: "promotions.detail.status.paused", fallback: "Paused" },
  expired: { key: "promotions.detail.status.expired", fallback: "Expired" },
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
    <ProgressiveStatusBar
      current={currentStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      successOutcomes={["expired"]}
      styles={STATUS_STYLES}
      labels={(status) => t(STATUS_KEYS[status].key) || STATUS_KEYS[status].fallback}
      onChange={onStatusChange}
      disabled={disabled}
    />
  )
}
