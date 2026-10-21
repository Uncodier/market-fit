import "server-only"

import { createClient } from "@/lib/supabase/server"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { userCanOnSite } from "@/lib/permissions/site-access"
import type { PermissionCommand } from "@/lib/permissions/types"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"

export const isPrivateResourceId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value)

/** Raw commerce projections have no location-scoped DTO: deny restricted staff. */
export async function requirePrivateCommerceSiteAccess(
  siteId: string,
  commands: PermissionCommand[] = ["select"],
  requireManager = false,
) {
  try {
    if (!isPrivateResourceId(siteId)) return { error: "Invalid site" } as const
    const supabase = await createClient(true)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user || user.is_anonymous) return { error: "Not authenticated" } as const
    const role = await lookupCurrentUserSiteRole(supabase, siteId)
    const roles = requireManager ? ["owner", "admin"] : ["owner", "admin", "collaborator", "marketing"]
    if (!role || !roles.includes(role) || !await canAccessUnscopedSite(supabase, siteId)) {
      return { error: "You do not have permission to access this site" } as const
    }
    for (const command of commands) {
      if (!await userCanOnSite(supabase, siteId, command)) {
        return { error: "You do not have permission to access this site" } as const
      }
    }
    return { supabase, user } as const
  } catch {
    return { error: "Site authorization could not be verified" } as const
  }
}