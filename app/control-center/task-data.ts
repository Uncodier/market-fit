import type { Task } from "@/app/types"
import type { TasksTable } from "@/types/supabase-tasks"

export type TaskQueryRow = TasksTable["Row"] & {
  leads?: { id: string; name: string } | null
  comments_count?: { count: number }[]
}

export function isTaskStatus(value: string): value is Task["status"] {
  return ["pending", "in_progress", "completed", "failed", "canceled"].includes(value)
}

function taskStage(value: string | null): Task["stage"] {
  switch (value) {
    case "awareness": case "consideration": case "decision":
    case "purchase": case "retention": case "referral":
      return value
    default:
      return undefined
  }
}

export function normalizeControlTask(row: TaskQueryRow): Task {
  return {
    ...row,
    lead_id: row.lead_id ?? undefined,
    assignee: row.assignee ?? undefined,
    type: row.type ?? undefined,
    stage: taskStage(row.stage),
    leads: row.leads ?? undefined,
  }
}