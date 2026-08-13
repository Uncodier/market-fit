import React from "react"
import { JourneyTimeline } from "./JourneyTimeline"
import { JourneyProgressBar } from "./JourneyProgressBar"
import { TasksProvider } from "../context/TasksContext"
import { Lead } from "@/app/leads/types"

const LEAD_STATUS_TO_STAGE: Record<Lead["status"], string> = {
  new: "awareness",
  contacted: "consideration",
  qualified: "decision",
  converted: "purchase",
  cold: "consideration",
  lost: "decision",
  not_qualified: "awareness",
}

interface JourneyViewProps {
  leadId: string
  leadStatus?: Lead["status"]
  currentStage?: string
}

export function JourneyView({ leadId, leadStatus, currentStage }: JourneyViewProps) {
  const stage = currentStage ?? (leadStatus ? LEAD_STATUS_TO_STAGE[leadStatus] : undefined)

  return (
    <TasksProvider leadId={leadId}>
      <JourneyProgressBar leadId={leadId} />
      <JourneyTimeline leadId={leadId} currentStage={stage} />
    </TasksProvider>
  )
}
