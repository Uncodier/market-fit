"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { automationSnoozeStateSchema } from "@/lib/chat/automation-snooze"
import { leadAutomationSnoozeHoursSchema, normalizeSiteAutomationSnooze, resolveAutomationSnoozeHours, siteAutomationSnoozeSchema } from "@/lib/chat/automation-snooze-policy"

const identitySchema = z.object({ leadId: z.string().uuid(), siteId: z.string().uuid() }).strict()
const leadSchema = z.object({ automation_snooze_hours: leadAutomationSnoozeHoursSchema })
const threadSchema = automationSnoozeStateSchema.omit({ automation_snooze_hours: true }).extend({ id: z.string().uuid() })
type Snapshot = {
  hours: number | null
  siteHours: number
  effectiveHours: number
  conversations: z.output<typeof threadSchema>[]
}
type Result<T> = { data: T; error?: never } | { data?: never; error: string }

async function authorize(leadId: string, siteId: string, command: "select" | "update") {
  const identity = identitySchema.parse({ leadId, siteId })
  const supabase = await createClient(true)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  if (!await userCanOnSite(supabase, siteId, command) || !await canAccessUnscopedSite(supabase, siteId)) throw new Error("Forbidden")
  return { supabase, ...identity }
}

export async function getLeadAutomationSnooze(leadId: string, siteId: string): Promise<Result<Snapshot>> {
  try {
    const access = await authorize(leadId, siteId, "select")
    // Establish the RLS-visible lead relationship BEFORE accessing tenant settings.
    const lead = await access.supabase.from("leads").select("automation_snooze_hours")
      .eq("id", access.leadId).eq("site_id", access.siteId).maybeSingle()
    const parsed = leadSchema.safeParse(lead.data)
    if (lead.error || !parsed.success) return { error: "Unable to load lead automation snooze." }
    const settings = await access.supabase.from("settings").select("activities")
      .eq("site_id", access.siteId).maybeSingle()
    if (settings.error || !settings.data) return { error: "Unable to load site automation snooze." }
    const site = siteAutomationSnoozeSchema.parse(normalizeSiteAutomationSnooze(settings.data?.activities?.conversation_automation_snooze))
    const conversations: Snapshot["conversations"] = []
    // Page rather than silently omitting threads above the PostgREST row limit.
    for (let offset = 0; ; offset += 500) {
      const threads = await access.supabase.from("conversations").select("id,automation_paused_until,last_human_reply_at")
        .eq("site_id", access.siteId).eq("lead_id", access.leadId).order("id").range(offset, offset + 499)
      const states = z.array(threadSchema).safeParse(threads.data)
      if (threads.error || !states.success) return { error: "Unable to load conversation pauses." }
      conversations.push(...states.data)
      if (states.data.length < 500) break
    }
    return { data: { hours: parsed.data.automation_snooze_hours,
      siteHours: resolveAutomationSnoozeHours(null, site),
      effectiveHours: resolveAutomationSnoozeHours(parsed.data.automation_snooze_hours, site), conversations } }
  } catch {
    return { error: "Unable to load automation snooze. Check your access and try again." }
  }
}

export async function updateLeadAutomationSnooze(leadId: string, siteId: string, hours: number | null): Promise<Result<{ hours: number | null }>> {
  const parsed = leadAutomationSnoozeHoursSchema.safeParse(hours)
  if (!parsed.success) return { error: "Choose inherit, off, or hours greater than 0 and up to 168." }
  try {
    const access = await authorize(leadId, siteId, "update")
    // This setting never changes existing pauses or applies to other leads.
    const result = await access.supabase.from("leads").update({ automation_snooze_hours: parsed.data })
      .eq("id", access.leadId).eq("site_id", access.siteId).select("automation_snooze_hours").maybeSingle()
    const saved = leadSchema.safeParse(result.data)
    if (result.error || !saved.success) return { error: "Unable to save lead automation snooze. Check your access and try again." }
    return { data: { hours: saved.data.automation_snooze_hours } }
  } catch {
    return { error: "Unable to save lead automation snooze. Check your access and try again." }
  }
}