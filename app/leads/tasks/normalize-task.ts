import type { Task } from "../types"
import type { TaskResponse } from "./actions"

export function normalizeJourneyTask(task: NonNullable<TaskResponse["task"]>): Task {
  return {
    ...task,
    description: task.description ?? "",
    completed_date: task.completed_date ?? undefined,
    amount: task.amount ?? undefined,
    assignee: task.assignee ?? undefined,
    notes: task.notes ?? undefined,
  }
}