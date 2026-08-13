"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { LEAD_STATUSES, STATUS_STYLES } from "@/app/leads/types"

type LeadStatus = "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified"

const FORWARD_PATH: LeadStatus[] = ["new", "contacted", "qualified", "converted"]
const OUTCOMES: LeadStatus[] = ["cold", "lost", "not_qualified"]

interface StatusSegmentBarProps {
  currentStatus: LeadStatus
  onStatusChange: (status: LeadStatus) => void
  className?: string
}

function statusName(id: LeadStatus) {
  return LEAD_STATUSES.find((status) => status.id === id)?.name || id
}

export function StatusSegmentBar({ currentStatus, onStatusChange, className }: StatusSegmentBarProps) {
  return (
    <ProgressiveStatusBar
      current={currentStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={statusName}
      onChange={onStatusChange}
      className={className}
    />
  )
}
