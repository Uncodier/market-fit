import { z } from "zod"
import { DEFAULT_AUTOMATION_SNOOZE_HOURS, MAX_AUTOMATION_SNOOZE_HOURS } from "./automation-snooze"

export const siteAutomationSnoozeSchema = z.object({
  status: z.enum(["default", "inactive"]).default("default"),
  hours: z.number().finite().positive().max(MAX_AUTOMATION_SNOOZE_HOURS).default(DEFAULT_AUTOMATION_SNOOZE_HOURS),
}).passthrough().default({})

export type SiteAutomationSnooze = z.output<typeof siteAutomationSnoozeSchema>

/** Preserve malformed hours for save validation, rather than silently replacing user input. */
export function normalizeSiteAutomationSnooze(value: unknown): SiteAutomationSnooze {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<SiteAutomationSnooze> : {}
  return { ...data, status: data.status === "inactive" ? "inactive" : "default",
    hours: data.hours === undefined ? DEFAULT_AUTOMATION_SNOOZE_HOURS : data.hours }
}

export const leadAutomationSnoozeHoursSchema = z.number().finite().min(0).max(MAX_AUTOMATION_SNOOZE_HOURS).nullable()

export function resolveAutomationSnoozeHours(leadHours: number | null, site: SiteAutomationSnooze): number {
  if (leadHours !== null) return leadHours
  return site.status === "inactive" ? 0 : site.hours
}