"use server"

import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { UpdateCallConsentSchema, type SavedCallConsent } from "./call-consent-schema"

export async function updateLeadCallConsent(input: unknown): Promise<
  { lead: SavedCallConsent; error?: never } | { error: string; lead?: never }
> {
  const parsed = UpdateCallConsentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid call consent settings. Confirm the change and provide a valid consent date when granting consent." }
  }

  try {
    // Consent must never be recorded through the demo/mock client.
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Sign in to update call consent." }

    const { id, site_id, expected, voice_call_consent_status, voice_call_consent_at, do_not_call } = parsed.data
    if (!await userCanOnSite(supabase, site_id, "update")) {
      return { error: "You do not have permission to update call consent for this site." }
    }

    // RLS enforces lead access. Compare the editor's snapshot atomically so a stale
    // grant cannot overwrite a newer revocation, phone change, or do-not-call flag.
    let query = supabase.from("leads").update({
      voice_call_consent_status,
      voice_call_consent_at,
      do_not_call,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("site_id", site_id)
      .eq("updated_at", expected.updated_at)
      .eq("voice_call_consent_status", expected.voice_call_consent_status)
      .eq("do_not_call", expected.do_not_call)

    query = expected.voice_call_consent_at === null
      ? query.is("voice_call_consent_at", null)
      : query.eq("voice_call_consent_at", expected.voice_call_consent_at)
    query = expected.phone === null ? query.is("phone", null) : query.eq("phone", expected.phone)

    const { data, error } = await query
      .select("id, updated_at, voice_call_consent_status, voice_call_consent_at, do_not_call")
      .maybeSingle()

    if (error) return { error: "Could not save call consent. Reload the lead to check its current settings before trying again." }
    if (!data) return { error: "The lead changed or is no longer accessible. Reload it before editing call consent again." }
    return { lead: data as SavedCallConsent }
  } catch {
    return { error: "Could not confirm whether call consent was saved. Reload the lead before trying again." }
  }
}