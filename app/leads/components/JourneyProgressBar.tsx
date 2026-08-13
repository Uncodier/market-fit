"use client"

import { Progress } from "@/app/components/ui/progress"
import { JOURNEY_STAGES } from "@/app/leads/types"
import { useTasks } from "../context/TasksContext"

export function JourneyProgressBar({ leadId }: { leadId: string }) {
  const { getTasksByLeadId, loading } = useTasks()
  const tasks = getTasksByLeadId(leadId)

  if (loading || tasks.length === 0) return null

  const completedStages = new Set(
    tasks.filter((task) => task.status === "completed").map((task) => task.stage)
  )
  const progress = Math.round((completedStages.size / JOURNEY_STAGES.length) * 100)
  const nextTask = tasks
    .filter((task) => task.status === "pending" || task.status === "in_progress")
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]

  return (
    <div className="flex items-center gap-3 pb-4 mb-1">
      <Progress value={progress} className="h-1 flex-1" />
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        {completedStages.size}/{JOURNEY_STAGES.length}
        {nextTask ? ` · Next: ${nextTask.title}` : ""}
      </p>
    </div>
  )
}
