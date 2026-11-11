import { z } from "zod"

export const DEFAULT_AUTOMATION_SNOOZE_HOURS = 4
export const MAX_AUTOMATION_SNOOZE_HOURS = 168

export const automationSnoozeStateSchema = z.object({
  automation_paused_until: z.string().datetime({ offset: true }).nullable(),
  last_human_reply_at: z.string().datetime({ offset: true }).nullable(),
  automation_snooze_hours: z.number().finite().min(0).max(MAX_AUTOMATION_SNOOZE_HOURS).nullable(),
})

export type AutomationSnoozeState = z.infer<typeof automationSnoozeStateSchema>

export const automationSnoozeMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    hours: automationSnoozeStateSchema.shape.automation_snooze_hours,
  }).strict(),
  z.object({
    action: z.literal("resume"),
    expectedPausedUntil: z.string().datetime({ offset: true }),
  }).strict(),
])

export type AutomationSnoozeMutation = z.infer<typeof automationSnoozeMutationSchema>

export function isAutomationPaused(until: string | null | undefined, now = Date.now()): boolean {
  return Boolean(until && Date.parse(until) > now)
}