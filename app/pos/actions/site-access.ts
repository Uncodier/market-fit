import "server-only"

import { createClient } from "@/lib/supabase/server"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"

export async function requirePosSiteAccess(siteId: string) {
  if (!siteId) return { error: "siteId is required" } as const

  const demoSite = siteId.startsWith("demo-")
  const supabase = await createClient(!demoSite)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Not authenticated" } as const

  const { data: role, error: roleError } = await supabase.rpc(
    "current_user_site_role",
    { p_site_id: siteId },
  )
  if (roleError || typeof role !== "string") {
    return { error: "Forbidden" } as const
  }

  // A trusted, isolated fixture client may authorize only its own demo tenant.
  // The prefix alone never bypasses checks for a real session or service client.
  if (demoSite && supabase._isDemo === true) return { supabase, user, role } as const

  // Check on every call, before cached snapshots, sync revisions or local replay.
  if (!await canAccessUnscopedSite(supabase, siteId)) {
    return { error: "This operation requires unrestricted location access" } as const
  }

  return { supabase, user, role } as const
}
