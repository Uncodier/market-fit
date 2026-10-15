import { createClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { MarketplaceRequestError } from "./request"

export async function authorizeMarketplaceResource(
  request: Request,
  table: "sale_orders" | "shipments",
  id: string,
) {
  const supabase = await createClient(true)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new MarketplaceRequestError("Unauthorized", 401)
  // RLS is applied before deriving the trusted tenant from the resource.
  const { data: resource, error } = await supabase.from(table)
    .select("id, site_id, metadata, marketplace_integration_id")
    .eq("id", id).maybeSingle()
  if (error || !resource) throw new MarketplaceRequestError("Resource not found", 404)
  const access = await requireSiteAccess(request, resource.site_id)
  if (access.error) {
    throw new MarketplaceRequestError(
      access.error.status === 401 ? "Unauthorized" : "Forbidden", access.error.status,
    )
  }
  const { data: canUpdate, error: permissionError } = await access.supabase.rpc("user_can", {
    p_site_id: resource.site_id,
    p_command: "update",
  })
  if (permissionError || canUpdate !== true) {
    throw new MarketplaceRequestError("Forbidden", 403)
  }
  if (!resource.marketplace_integration_id || !resource.metadata?.marketplace) {
    throw new MarketplaceRequestError("Resource is not managed by a marketplace", 409)
  }
  return { resource, userId: access.userId }
}