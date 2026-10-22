import "server-only"
import { requirePrivateCommerceSiteAccess } from "./private-site-access"
import { normalizePublicCheckoutInput } from "./public-checkout-input"
import type { CheckoutCartParams } from "./checkout-types"

/** Staff privilege requires fresh site authorization even for internal Server Action callers. */
export async function authorizeCheckoutBoundary(params: CheckoutCartParams) {
  if (!params || !["pos", "sales", "shop", "marketplace", "quote"].includes(params.source)) throw new Error("Invalid checkout source.")
  if (params.source === "pos") return { params, publicCheckout: false }
  if (params.source === "sales" || params.isStaffMutation === true) {
    const access = await requirePrivateCommerceSiteAccess(params.siteId, ["select", "insert", "update"])
    if (access.error) throw new Error(access.error)
    const { data: role, error } = await access.supabase.rpc("current_user_site_role", { p_site_id: params.siteId })
    if (error || !["owner", "admin", "collaborator"].includes(role)) throw new Error("Staff checkout is not authorized.")
    if (params.existingOrderId) {
      const order = await access.supabase.from("sale_orders").select("id").eq("site_id", params.siteId).eq("id", params.existingOrderId).maybeSingle()
      if (order.error || !order.data) throw new Error("Order is not available for this site.")
    }
    return { params: { ...params, userId: access.user.id }, publicCheckout: false }
  }
  return { params: normalizePublicCheckoutInput(params), publicCheckout: true }
}