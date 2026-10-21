import "server-only"
import type { createClient } from "@/lib/supabase/server"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"

export async function readOrderAccess(
  supabase: Awaited<ReturnType<typeof createClient>>, siteId: string,
): Promise<{ error?: string }> {
  try {
    return await lookupCurrentUserSiteRole(supabase, siteId) ? {} : { error: "Forbidden" }
  } catch (error) {
    if (error instanceof SiteRoleLookupError) {
      return { error: "Order access could not be verified. Please try again." }
    }
    throw error
  }
}