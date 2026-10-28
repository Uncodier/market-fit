import { commerceResult, procurementAccess } from "../http"

export async function GET(request: Request) {
  const access = await procurementAccess(request)
  if (access.error) return access.error
  const { data, error } = await access.supabase.rpc("list_procurement_orders", { p_site: access.siteId })
  return commerceResult(data, error)
}