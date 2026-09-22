import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function requirePosSiteAccess(siteId: string) {
  if (!siteId) return { error: "siteId is required" } as const

  const supabase = await createClient()
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

  return { supabase, user, role } as const
}
