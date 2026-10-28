import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { privateHeaders, procurementError, uuid } from "../http"

export async function supplierAccess(request: Request, command: "select" | "insert" | "update") {
  const params = new URL(request.url).searchParams
  const site = uuid.safeParse(params.get("site_id"))
  if (!site.success || params.getAll("site_id").length !== 1) {
    return { error: procurementError("A valid workspace is required", 400) } as const
  }
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get("cookie") ?? "")) {
    return { error: procurementError("Suppliers are unavailable in demo mode", 403) } as const
  }
  const access = await requireSiteAccess(request, site.data)
  if (access.error) {
    access.error.headers.set("Cache-Control", privateHeaders["Cache-Control"])
    return { error: access.error } as const
  }
  if (command !== "select" && !["owner", "admin", "collaborator"].includes(access.role)) {
    return { error: procurementError("Forbidden", 403) } as const
  }
  const permission = await access.supabase.rpc("user_can", { p_site_id: site.data, p_command: command })
  if (permission.error) return { error: procurementError("Unable to verify access", 503) } as const
  if (permission.data !== true) return { error: procurementError("Forbidden", 403) } as const
  return { ...access, siteId: site.data } as const
}