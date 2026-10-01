import { z } from "zod"
import { optionalActivityStartTimeSchema } from "@/lib/activity-start-time"

export const DAILY_STANDUP_WEEKDAYS = [1, 5]
export const DAILY_STANDUP_REPORT_SECTIONS = [
  "sales", "tasks", "requirements", "social", "channels", "records", "orders", "reservations", "inventory",
] as const

export const dailyStandupSettingsSchema = z.preprocess(
  value => typeof value === "string" ? { status: value } : value ?? {},
  z.object({
    status: z.enum(["active", "inactive", "default"]).default("inactive")
      .transform(value => value === "active" ? "active" as const : "inactive" as const),
    weekdays: z.array(z.number().int().min(0).max(6)).default(DAILY_STANDUP_WEEKDAYS),
    start_time: optionalActivityStartTimeSchema,
    report_sections: z.array(z.enum(DAILY_STANDUP_REPORT_SECTIONS)).default([...DAILY_STANDUP_REPORT_SECTIONS]),
  }).passthrough().superRefine((value, ctx) => {
    if (value.status !== "active") return
    if (!value.weekdays.length) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ["weekdays"],
      message: "Select at least one weekday before enabling Daily Standup.",
    })
    if (!value.report_sections.length) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ["report_sections"],
      message: "Select at least one report section before enabling Daily Standup.",
    })
  }),
)

export type DailyStandupSettings = z.output<typeof dailyStandupSettingsSchema>
export type DailyStandupReportSection = DailyStandupSettings["report_sections"][number]

const asRecord = (value: unknown): Record<string, unknown> => typeof value === "string"
  ? { status: value }
  : value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Default only missing selections. Keep empty or malformed values for explicit validation. */
export function normalizeDailyStandupSettings(value: unknown): DailyStandupSettings {
  const data = asRecord(value) as Partial<DailyStandupSettings>
  return {
    ...data,
    status: data.status === "active" ? "active" : "inactive",
    // Keep an undefined form baseline for the optional controller; JSON omits it.
    start_time: data.start_time,
    weekdays: data.weekdays === undefined ? [...DAILY_STANDUP_WEEKDAYS] : data.weekdays,
    report_sections: data.report_sections === undefined ? [...DAILY_STANDUP_REPORT_SECTIONS] : data.report_sections,
  }
}

/** Legacy string and object status-only updates must not erase a configured selection. */
export function mergeDailyStandupSettings(existing: unknown, updates: unknown) {
  const patch = Object.fromEntries(Object.entries(asRecord(updates)).filter(([key, value]) => key !== "start_time" || value !== undefined))
  return normalizeDailyStandupSettings({ ...asRecord(existing), ...patch })
}