import { createClient } from "@/lib/supabase/server"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"

export async function reservationReadClient(siteId: string) {
  if (typeof siteId !== "string" || !siteId.trim()) throw new Error("A site is required.")
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  if (!await lookupCurrentUserSiteRole(db, siteId)) throw new Error("Forbidden")
  // This remains a session client: membership verification does not bypass RLS.
  return db
}