"use client"

import { useState } from "react"
import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { DEAL_STAGES, STAGE_STYLES, Deal } from "@/app/deals/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

type DealStage = Deal["stage"]

const FORWARD_PATH: DealStage[] = ["prospecting", "qualification", "proposal", "negotiation"]
const OUTCOMES: DealStage[] = ["closed_won", "closed_lost"]

function stageName(id: DealStage) {
  if (id === "closed_won") return "Won"
  if (id === "closed_lost") return "Lost"
  return DEAL_STAGES.find((stage) => stage.id === id)?.name || id
}

export function stageToStatus(stage: DealStage): Deal["status"] {
  if (stage === "closed_won") return "won"
  if (stage === "closed_lost") return "lost"
  return "open"
}

export function DealStageBar({
  currentStage,
  onStageChange,
  className,
}: {
  currentStage: DealStage
  onStageChange: (stage: DealStage) => void
  className?: string
}) {
  const [pendingStage, setPendingStage] = useState<DealStage | null>(null)

  const selectStage = (stage: DealStage) => {
    if ((stage === "closed_won" || stage === "closed_lost") && currentStage !== stage) {
      setPendingStage(stage)
      return
    }
    onStageChange(stage)
  }

  return (
    <>
      <ProgressiveStatusBar
        current={currentStage}
        forwardPath={FORWARD_PATH}
        outcomes={OUTCOMES}
        successOutcomes={["closed_won"]}
        styles={STAGE_STYLES}
        labels={stageName}
        onChange={selectStage}
        className={className}
      />

      <AlertDialog open={Boolean(pendingStage)} onOpenChange={(open) => !open && setPendingStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark deal as {pendingStage === "closed_won" ? "won" : "lost"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the deal pipeline and metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStage) onStageChange(pendingStage)
                setPendingStage(null)
              }}
              className={
                pendingStage === "closed_won"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
