"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useLocalization } from "@/app/context/LocalizationContext"

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

const FORWARD_PATH: QuotationStatus[] = ["draft", "sent", "accepted"]
const OUTCOMES: QuotationStatus[] = ["rejected", "expired"]

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  sent: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  accepted: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  rejected: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  expired: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
}

const STATUS_KEYS: Record<QuotationStatus, { key: string; fallback: string }> = {
  draft: { key: "status.draft", fallback: "Draft" },
  sent: { key: "status.sent", fallback: "Sent" },
  accepted: { key: "status.accepted", fallback: "Accepted" },
  rejected: { key: "status.rejected", fallback: "Rejected" },
  expired: { key: "quotations.status.expired", fallback: "Expired" },
}

interface QuotationStatusBarProps {
  currentStatus: string
  onStatusChange: (status: QuotationStatus) => void
  disabled?: boolean
  disabledStatuses?: QuotationStatus[]
}

export function QuotationStatusBar({
  currentStatus,
  onStatusChange,
  disabled,
  disabledStatuses = [],
}: QuotationStatusBarProps) {
  const { t } = useLocalization()

  return (
    <ProgressiveStatusBar
      current={currentStatus as QuotationStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={(status) => t(STATUS_KEYS[status].key) || STATUS_KEYS[status].fallback}
      onChange={onStatusChange}
      disabled={disabled}
      disabledStatuses={disabledStatuses}
    />
  )
}
