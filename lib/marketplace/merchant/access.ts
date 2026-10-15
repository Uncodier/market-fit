import "server-only"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

export async function requireMerchantManager(request: Request, siteId: string) {
  const access = await requireSiteAccess(request, siteId, { requireManager: true })
  if (access.error) return access
  const permission = await access.supabase.rpc("user_can", { p_site_id: siteId, p_command: "update" })
  if (permission.error || permission.data !== true) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return access
}