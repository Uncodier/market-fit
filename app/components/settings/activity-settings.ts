import { z } from "zod"
import { isOutreachChannel, normalizeOutreachChannelAccounts, normalizeOutreachSettings, validateOutreachSettings, type OutreachActivityKey } from "@/lib/outreach-settings"

const status = (value: any) => value?.status ?? value
const standard = (value: any) => ({ status: status(value) === "inactive" ? "inactive" as const : "default" as const })
const optIn = (value: any) => ({ status: ["active", "default"].includes(status(value)) ? "active" as const : "inactive" as const })

/** Shared by hydration, form defaults and both save paths so activity parameters survive round trips. */
export function normalizeActivitySettings(value: any = {}) {
  const data = value || {}
  return {
    daily_resume_and_stand_up: { status: status(data.daily_resume_and_stand_up) === "active" ? "active" as const : "inactive" as const },
    local_lead_generation: standard(data.local_lead_generation),
    icp_lead_generation: standard(data.icp_lead_generation),
    leads_initial_cold_outreach: normalizeOutreachSettings(data.leads_initial_cold_outreach),
    leads_follow_up: normalizeOutreachSettings(data.leads_follow_up),
    email_sync: standard(data.email_sync),
    assign_leads_to_team: optIn(data.assign_leads_to_team),
    notify_team_on_inbound_conversations: standard(data.notify_team_on_inbound_conversations),
    supervise_conversations: optIn(data.supervise_conversations),
  }
}

function outreachSchema(key: OutreachActivityKey) {
  return z.preprocess(value => typeof value === "string" ? { status: value } : value, z.object({
    status: z.enum(["active", "inactive", "default"]).default("inactive").transform(value => value === "active" ? "active" as const : "inactive" as const),
    channel_accounts: z.record(
      z.string().refine(isOutreachChannel, "Use a safe channel key; audio is a message format, not a channel."),
      z.array(z.string()),
    ).default({}).transform(normalizeOutreachChannelAccounts),
    segment_ids: z.array(z.string()).default([]),
    all_segments: z.boolean().default(false),
    daily_message_limit: z.number().int().min(1).max(10000).default(30),
    max_unanswered_messages: z.number().int().min(1).max(100).default(3),
    weekdays: z.array(z.number().int().min(0).max(6)).default([2, 3, 4]),
  }).default({}).superRefine((value, ctx) => {
    for (const error of validateOutreachSettings(value, key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [error.field], message: error.message })
    }
  }))
}

const standardSchema = z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({})
const optInSchema = z.object({ status: z.enum(["inactive", "active"]).default("inactive") }).default({})
export const activitiesSchema = z.object({
  daily_resume_and_stand_up: optInSchema,
  local_lead_generation: standardSchema,
  icp_lead_generation: standardSchema,
  leads_initial_cold_outreach: outreachSchema("leads_initial_cold_outreach"),
  leads_follow_up: outreachSchema("leads_follow_up"),
  email_sync: standardSchema,
  assign_leads_to_team: optInSchema,
  notify_team_on_inbound_conversations: standardSchema,
  supervise_conversations: optInSchema,
}).default({})