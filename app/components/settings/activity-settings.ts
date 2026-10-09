import { z } from "zod"
import { isOutreachChannel, normalizeOutreachChannelAccounts, normalizeOutreachSettings, validateOutreachSettings, type OutreachActivityKey, type OutreachSettings } from "@/lib/outreach-settings"
import { icpLeadGenerationSettingsSchema, normalizeIcpLeadGenerationSettings } from "./icp-lead-generation-settings"
import { dailyStandupSettingsSchema, normalizeDailyStandupSettings } from "./daily-standup-settings"
import { activityTimingFields, TIMED_ACTIVITY_KEYS, type ActivityStartTimeMode } from "@/lib/activity-start-time"

const status = (value: unknown) => record(value).status ?? value
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const statusPatch = (value: unknown) => typeof value === "string" ? { status: value } : record(value)
// Optional form defaults are omission, not deletion, including before hydration.
const activityPatch = (key: string, value: unknown) => Object.fromEntries(Object.entries(statusPatch(value)).filter(
  ([parameter, entry]) => !["start_time", "start_time_mode"].includes(parameter) || entry !== undefined || !(TIMED_ACTIVITY_KEYS as readonly string[]).includes(key),
))
const standard = (value: unknown) => ({ ...record(value), status: status(value) === "inactive" ? "inactive" as const : "default" as const })
const optIn = (value: unknown) => ({ ...record(value), status: status(value) === "active" || status(value) === "default" ? "active" as const : "inactive" as const })

/** Shared by hydration, form defaults and both save paths so activity parameters survive round trips. */
export function normalizeActivitySettings(value: unknown = {}) {
  const data = record(value)
  return {
    ...data,
    daily_resume_and_stand_up: normalizeDailyStandupSettings(data.daily_resume_and_stand_up),
    local_lead_generation: standard(data.local_lead_generation),
    icp_lead_generation: normalizeIcpLeadGenerationSettings(data.icp_lead_generation),
    leads_initial_cold_outreach: { start_time: undefined as string | undefined, start_time_mode: undefined as ActivityStartTimeMode | undefined, ...record(data.leads_initial_cold_outreach), ...normalizeOutreachSettings(data.leads_initial_cold_outreach) },
    // An undefined baseline lets the optional time controller reset across sites without persisting a default.
    leads_follow_up: { start_time: undefined as string | undefined, start_time_mode: undefined as ActivityStartTimeMode | undefined, ...record(data.leads_follow_up), ...normalizeOutreachSettings(data.leads_follow_up) },
    invoices_due: { start_time: undefined as string | undefined, start_time_mode: undefined as ActivityStartTimeMode | undefined, ...record(data.invoices_due), ...normalizeOutreachSettings(data.invoices_due, "invoices_due") },
    email_sync: standard(data.email_sync),
    assign_leads_to_team: optIn(data.assign_leads_to_team),
    notify_team_on_inbound_conversations: standard(data.notify_team_on_inbound_conversations),
    supervise_conversations: optIn(data.supervise_conversations),
  }
}

/** Merge before applying defaults so partial updates cannot reset neighboring activities. */
export function mergeActivitySettings(existing: unknown, updates: unknown) {
  const previous = record(existing)
  const incoming = record(updates)
  return normalizeActivitySettings({
    ...previous,
    ...Object.fromEntries(Object.entries(incoming).map(([key, value]) => [
      key,
      typeof value === "string" || (value && typeof value === "object" && !Array.isArray(value))
        ? { ...statusPatch(previous[key]), ...activityPatch(key, value) } : value,
    ])),
  })
}

/** Keep a validated update partial until the writer merges it with the latest readable row. */
export function validatedActivityUpdates(validated: unknown, updates: unknown) {
  const normalized = record(validated)
  return Object.fromEntries(Object.entries(record(updates)).map(([key, value]) => [
    key,
    Object.fromEntries(Object.keys(activityPatch(key, value)).map(parameter => [parameter, record(normalized[key])[parameter]])),
  ]))
}

function outreachSchema<T extends z.ZodRawShape>(key: OutreachActivityKey, fields: T) {
  return z.preprocess(value => {
    let data = value === undefined ? {} : typeof value === "string" ? { status: value } : value
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (key === "invoices_due" && record(data).cooldown_mode === undefined) {
        data = { ...data, cooldown_mode: record(data).repeat_interval_days === undefined ? "progressive" : "fixed" }
      }
      if (key === "invoices_due" && record(data).start_time === undefined && record(data).start_time_mode === undefined) {
        data = { ...data, start_time_mode: "business_opening" }
      }
    }
    return data
  }, z.object({
    status: z.enum(["active", "inactive", "default"]).default("inactive").transform(value => value === "active" ? "active" as const : "inactive" as const),
    channel_accounts: z.record(
      z.string().refine(isOutreachChannel, "Use a safe channel key; audio is a message format, not a channel."),
      z.array(z.string()),
    ).default({}).transform(value => key === "invoices_due" ? Object.fromEntries(Object.entries(normalizeOutreachChannelAccounts(value)).filter(([channel]) => Object.prototype.hasOwnProperty.call(value, channel))) : normalizeOutreachChannelAccounts(value)),
    segment_ids: z.array(z.string()).default([]),
    all_segments: z.boolean().default(false),
    daily_message_limit: z.number().int().min(1).max(10000).default(30),
    max_unanswered_messages: key === "invoices_due" ? z.custom<number>(() => true).default(3) : z.number().int().min(1).max(100).default(3),
    cooldown_mode: key === "invoices_due" ? z.enum(["progressive", "fixed"]).optional() : z.enum(["progressive", "fixed"]).default("progressive"),
    ...(key === "invoices_due" ? {} : { cooldown_period_days: z.number().optional() }),
    weekdays: z.array(z.number().int().min(0).max(6)).default(key === "invoices_due" ? [1, 2, 3, 4, 5] : [2, 3, 4]),
    ...fields,
  }).passthrough().superRefine((value, ctx) => {
    for (const error of validateOutreachSettings(value as OutreachSettings, key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [error.field], message: error.message })
    }
  }))
}

const standardSchema = z.object({ status: z.enum(["default", "inactive"]).default("default") }).passthrough().default({})
const optInSchema = z.object({ status: z.enum(["inactive", "active"]).default("inactive") }).passthrough().default({})
export const invoicesDueSettingsSchema = outreachSchema("invoices_due", { ...activityTimingFields, repeat_interval_days: z.number().int().min(1).max(365).default(3) })
export const activitiesSchema = z.object({
  daily_resume_and_stand_up: dailyStandupSettingsSchema,
  local_lead_generation: standardSchema,
  icp_lead_generation: icpLeadGenerationSettingsSchema,
  leads_initial_cold_outreach: outreachSchema("leads_initial_cold_outreach", activityTimingFields),
  leads_follow_up: outreachSchema("leads_follow_up", activityTimingFields),
  invoices_due: invoicesDueSettingsSchema,
  email_sync: standardSchema,
  assign_leads_to_team: optInSchema,
  notify_team_on_inbound_conversations: standardSchema,
  supervise_conversations: optInSchema,
}).passthrough().default({})