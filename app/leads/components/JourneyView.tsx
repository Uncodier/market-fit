import React from "react"
import { JourneyTimeline } from "./JourneyTimeline"
import { TasksProvider } from "../context/TasksContext"

interface JourneyViewProps {
  leadId: string;
}

export function JourneyView({ leadId }: JourneyViewProps) {
  return (
    <TasksProvider leadId={leadId}>
      <div className="w-full pb-6 flex flex-col h-full overflow-auto">
        <div className="mt-0">
          <JourneyTimeline leadId={leadId} />
        </div>
      </div>
    </TasksProvider>
  )
} 