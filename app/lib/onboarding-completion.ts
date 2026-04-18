import {
  ALL_TASK_IDS,
} from "@/app/components/dashboard/hooks/use-onboarding-validation"

export function countOnboardingProgress(
  onboarding: Record<string, boolean> | null | undefined
): { done: number; total: number } {
  const total = ALL_TASK_IDS.length
  if (!onboarding) return { done: 0, total }
  const done = ALL_TASK_IDS.filter((id) => onboarding[id] === true).length
  return { done, total }
}

export function isOnboardingFullyComplete(
  onboarding: Record<string, boolean> | null | undefined
): boolean {
  if (!onboarding) return false
  return ALL_TASK_IDS.every((id) => onboarding[id] === true)
}
