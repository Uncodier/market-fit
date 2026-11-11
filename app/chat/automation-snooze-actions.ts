"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import {
  automationSnoozeMutationSchema,
  automationSnoozeStateSchema,
  type AutomationSnoozeMutation,
  type AutomationSnoozeState,
} from "@/lib/chat/automation-snooze"

const identitySchema = z.object({ conversationId: z.string().uuid(), siteId: z.string().uuid() }).strict()
const projection = "automation_paused_until,last_human_reply_at,automation_snooze_hours"
type Result = { data: AutomationSnoozeState; error?: never } | { data?: never; error: string }

async function authorize(conversationId: string, siteId: string, command: "select" | "update") {
  const identity = identitySchema.parse({ conversationId, siteId })
  // Always use the signed-in user and RLS, never the service role or demo client.
  const supabase = await createClient(true)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  if (!await userCanOnSite(supabase, identity.siteId, command) ||
      !await canAccessUnscopedSite(supabase, identity.siteId)) throw new Error("Forbidden")
  return { supabase, ...identity }
}

export async function getConversationAutomationSnooze(conversationId: string, siteId: string): Promise<Result> {
  try {
    const access = await authorize(conversationId, siteId, "select")
    const { data, error } = await access.supabase.from("conversations").select(projection)
      .eq("id", access.conversationId).eq("site_id", access.siteId).maybeSingle()
    const parsed = automationSnoozeStateSchema.safeParse(data)
    if (error || !parsed.success) return { error: "Unable to load automation snooze." }
    return { data: parsed.data }
  } catch {
    return { error: "Unable to load automation snooze. Check your access and try again." }
  }
}

export async function updateConversationAutomationSnooze(
  conversationId: string,
  siteId: string,
  mutation: AutomationSnoozeMutation,
): Promise<Result> {
  const parsed = automationSnoozeMutationSchema.safeParse(mutation)
  if (!parsed.success) return { error: "Use default hours or a number from 0 to 168." }
  if (parsed.data.action !== "resume") return { error: "Change snooze hours from the lead menu or AI Activities." }
  try {
    const access = await authorize(conversationId, siteId, "update")
    const input = parsed.data
    // Resume is the only supported legacy mutation; lead/site settings own future replies.
    let query = access.supabase.from("conversations").update({ automation_paused_until: null })
      .eq("id", access.conversationId).eq("site_id", access.siteId)
      .eq("automation_paused_until", input.expectedPausedUntil)
    // Expiry can remain identical after another reply (e.g. a maximum/clamped pause).
    query = input.expectedLastHumanReplyAt === null
      ? query.is("last_human_reply_at", null)
      : query.eq("last_human_reply_at", input.expectedLastHumanReplyAt)
    const { data, error } = await query.select(projection).maybeSingle()
    const state = automationSnoozeStateSchema.safeParse(data)
    if (error) return { error: "Unable to update automation snooze. Check your access and try again." }
    if (!state.success) return { error: "The conversation changed or is unavailable. Refresh and try again." }
    return { data: state.data }
  } catch {
    return { error: "Unable to update automation snooze. Check your access and try again." }
  }
}