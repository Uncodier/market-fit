"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"

type ExperimentStatus = "draft" | "active" | "completed"

const FORWARD_PATH: ExperimentStatus[] = ["draft", "active"]
const OUTCOMES: ExperimentStatus[] = ["completed"]

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  draft: "bg-secondary/20 text-secondary-foreground border-secondary/20",
  active: "bg-success/20 text-success border-success/20",
  completed: "bg-info/20 text-info border-info/20",
}

const STATUS_NAMES: Record<ExperimentStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
}

export function ExperimentStatusBar({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: ExperimentStatus
  onStatusChange: (status: ExperimentStatus) => void
}) {
  return (
    <div className="overflow-x-auto">
      <ProgressiveStatusBar
        current={currentStatus}
        forwardPath={FORWARD_PATH}
        outcomes={OUTCOMES}
        successOutcomes={["completed"]}
        styles={STATUS_STYLES}
        labels={STATUS_NAMES}
        onChange={onStatusChange}
      />
    </div>
  )
}
