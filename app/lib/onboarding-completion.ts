import { ALL_TASK_IDS } from "@/app/lib/onboarding-task-ids"

export interface OnboardingProgress { done: number; total: number }

/** A null JSON column means no tasks completed; a missing column/read is unknown. */
export function readOnboardingProgress(raw: unknown): OnboardingProgress | undefined {
  if (raw === null) return { done: 0, total: ALL_TASK_IDS.length }
  if (typeof raw !== 'object' || Array.isArray(raw) || !raw) return undefined
  const tasks = raw as Record<string, unknown>
  return { done: ALL_TASK_IDS.filter(id => tasks[id] === true).length, total: ALL_TASK_IDS.length }
}
