import "server-only"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"

type PosAccess = Pick<Extract<Awaited<ReturnType<typeof requirePosSiteAccess>>, { role: string }>, "supabase" | "user" | "role">

export async function requireRegisterAccess(siteId: string): Promise<PosAccess | { error: string }> {
  const access = await requirePosSiteAccess(siteId)
  if (access.error !== undefined) return { error: access.error } as const
  if (!["owner", "admin", "collaborator"].includes(access.role)) {
    return { error: "You do not have permission to use Cash Register." } as const
  }
  return { supabase: access.supabase, user: access.user, role: access.role } as const
}