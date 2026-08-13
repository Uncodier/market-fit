"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"

type SegmentStatus = "draft" | "active"

const FORWARD_PATH: SegmentStatus[] = ["draft", "active"]

const STATUS_STYLES: Record<SegmentStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200",
  active: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
}

const STATUS_NAMES: Record<SegmentStatus, string> = {
  draft: "Draft",
  active: "Active",
}

interface SegmentStatusWidgetProps {
  isActive: boolean
  onStatusChange: () => Promise<void>
}

export function SegmentStatusWidget({ isActive, onStatusChange }: SegmentStatusWidgetProps) {
  const current: SegmentStatus = isActive ? "active" : "draft"

  return (
    <ProgressiveStatusBar
      current={current}
      forwardPath={FORWARD_PATH}
      styles={STATUS_STYLES}
      labels={STATUS_NAMES}
      onChange={(status) => {
        if (status !== current) {
          void onStatusChange()
        }
      }}
    />
  )
}
