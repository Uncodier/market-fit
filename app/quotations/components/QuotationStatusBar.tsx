"use client"

import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

const QUOTATION_STATUSES: Array<{ id: QuotationStatus; key: string; fallback: string }> = [
  { id: "draft", key: "status.draft", fallback: "Draft" },
  { id: "sent", key: "status.sent", fallback: "Sent" },
  { id: "accepted", key: "status.accepted", fallback: "Accepted" },
  { id: "rejected", key: "status.rejected", fallback: "Rejected" },
  { id: "expired", key: "quotations.status.expired", fallback: "Expired" },
]

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  sent: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  accepted: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  rejected: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  expired: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
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
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {QUOTATION_STATUSES.map((status) => {
          const isDisabled =
            disabled || (disabledStatuses.includes(status.id) && currentStatus !== status.id)
          return (
            <Badge
              key={status.id}
              className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
                currentStatus === status.id
                  ? STATUS_STYLES[status.id]
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
              } ${isDisabled ? "pointer-events-none opacity-60" : ""}`}
              onClick={() => {
                if (!isDisabled && currentStatus !== status.id) {
                  onStatusChange(status.id)
                }
              }}
            >
              {t(status.key) || status.fallback}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
