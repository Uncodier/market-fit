import "server-only"

import { createClient } from "@/lib/supabase/server"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"

type PosSiteAccess =
  | { error: string; supabase?: never; user?: never; role?: never }
  | { error?: never; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string }; role: string }

export async function requirePosSiteAccess(siteId: string): Promise<PosSiteAccess> {
  if (!siteId) return { error: "siteId is required" } as const

  const demoSite = siteId.startsWith("demo-")
  const supabase = await createClient(!demoSite)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Not authenticated" } as const

  let role: string | null
  try {
    role = await lookupCurrentUserSiteRole(supabase, siteId)
  } catch (error) {
    if (error instanceof SiteRoleLookupError) return { error: error.message } as const
    throw error
  }
  if (!role) {
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
