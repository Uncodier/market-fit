import { z } from "zod"

export const ACTIVITY_START_TIME_ERROR = "Enter a custom time in HH:mm (24-hour format)."
export type ActivityStartTimeMode = "business_opening" | "custom"
export const TIMED_ACTIVITY_KEYS = ["daily_resume_and_stand_up", "leads_follow_up", "leads_initial_cold_outreach", "invoices_due"] as const
export type TimedActivityKey = typeof TIMED_ACTIVITY_KEYS[number]
const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidActivityStartTime(value: unknown): value is string {
  return typeof value === "string" && value.length === 5 && START_TIME_PATTERN.test(value)
}

/** Missing preserves the legacy schedule; empty, null and malformed times are invalid. */
export const optionalActivityStartTimeSchema = z.string({ invalid_type_error: ACTIVITY_START_TIME_ERROR })
  .length(5, ACTIVITY_START_TIME_ERROR).regex(START_TIME_PATTERN, ACTIVITY_START_TIME_ERROR).optional()

export function activityTimeErrors(value: { start_time_mode?: unknown; start_time?: unknown }) {
  if (value.start_time_mode !== undefined && value.start_time_mode !== "business_opening" && value.start_time_mode !== "custom") {
    return [{ field: "start_time_mode" as const, message: "Choose business opening time or custom time." }]
  }
  if (value.start_time_mode === "business_opening") return []
  return (value.start_time_mode === "custom" || value.start_time !== undefined) && !isValidActivityStartTime(value.start_time)
    ? [{ field: "start_time" as const, message: ACTIVITY_START_TIME_ERROR }] : []
}

// Validate the pair together: opening mode deliberately ignores retained custom values.
export const activityTimingFields = {
  start_time_mode: z.custom<ActivityStartTimeMode>(() => true).optional(),
  start_time: z.custom<string>(() => true).optional(),
}
export const activityTimingSchema = z.object(activityTimingFields).superRefine((value, ctx) => {
  for (const error of activityTimeErrors(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [error.field], message: error.message })
})

export function displayedActivityTimeMode(value: { start_time_mode?: unknown; start_time?: unknown }): string {
  if (value.start_time_mode !== undefined) return typeof value.start_time_mode === "string" ? value.start_time_mode : ""
  return value.start_time !== undefined ? "custom" : "business_opening"
}