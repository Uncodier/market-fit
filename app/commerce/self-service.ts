import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { getShopSite } from "@/app/shop/[siteSlug]/actions"
import { getSelfServiceOptions, isSelfServiceItem } from "./self-service-options"
import { verifyBuyerIdentityToken } from "./buyer-identity-token"
import { assertSelfServiceModifiers } from "./self-service-modifiers"
import type { CheckoutCartParams, CheckoutSupabaseClient } from "./checkout-types"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Public location lookup is restricted to an active branch of a non-archived shop. */
export async function resolveSelfServiceLocation(locationId: string, client?: CheckoutSupabaseClient) {
  if (typeof locationId !== "string" || !UUID.test(locationId)) return null
  const supabase = client || await createServiceClient(true, { access: "public" })
  const { data: location, error } = await supabase.from("locations")
    .select("id, site_id, name, address, city, state, zip, country, is_active, is_default")
    .eq("id", locationId).eq("is_active", true).maybeSingle()
  if (error) throw new Error("Unable to verify the self-service location.")
  if (!location) return null
  const { data: activeSite, error: siteError } = await supabase.from("sites")
    .select("id").eq("id", location.site_id).is("archived_at", null).maybeSingle()
  if (siteError) throw new Error("Unable to verify the self-service shop.")
  if (!activeSite) return null
  const site = await getShopSite(location.site_id)
  if (!site || site.id !== location.site_id) return null
  const fulfillmentOptions = getSelfServiceOptions(site.settings?.shop)
  return fulfillmentOptions.length ? { site, location, fulfillmentOptions } : null
}

export async function resolveSelfServiceBuyer(code: string, supabase: CheckoutSupabaseClient) {
  const userId = verifyBuyerIdentityToken(code)
  if (!userId) throw new Error("Invalid or expired account QR. Refresh it on your phone or continue anonymously.")
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const user = data?.user
  if (error || !user || user.deleted_at || (user.banned_until && new Date(user.banned_until).getTime() > Date.now())) {
    throw new Error("Invalid or expired account QR. Refresh it on your phone or continue anonymously.")
  }
  return {
    userId: user.id as string,
    name: String(user.user_metadata?.full_name || user.user_metadata?.name || "Customer").slice(0, 120),
    email: typeof user.email === "string" ? user.email : undefined,
  }
}

/** Allowlist all public kiosk input; staff/payment/tenant/price fields never survive. */
export function normalizeSelfServiceCheckout(params: CheckoutCartParams, siteId: string): CheckoutCartParams {
  if (params.source !== "shop") throw new Error("Self-service checkout requires the Shop channel.")
  if (!["pickup", "dine_in"].includes(params.fulfillment)) throw new Error("Self-service only supports takeaway or dine-in.")
  if (!params.selfServiceLocationId || !UUID.test(params.selfServiceLocationId)) throw new Error("Invalid self-service location.")
  if (!Array.isArray(params.lines) || !params.lines.length || params.lines.length > 50) throw new Error("Invalid self-service cart.")
  let modifierCount = 0
  const lines = params.lines.map((line) => {
    if (!UUID.test(line.catalogItemId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) throw new Error("Invalid cart line.")
    if (line.modifiers && (!Array.isArray(line.modifiers) || line.modifiers.length > 25)) throw new Error("Invalid cart modifiers.")
    const modifiers = (line.modifiers || []).map((modifier) => {
      modifierCount++
      if (!UUID.test(modifier.catalogItemId) || !Number.isSafeInteger(modifier.quantity) || modifier.quantity < 1 || modifier.quantity > 1000 ||
        (modifier.groupId !== undefined && !UUID.test(modifier.groupId))) throw new Error("Invalid cart modifier.")
      return { catalogItemId: modifier.catalogItemId, quantity: modifier.quantity, groupId: modifier.groupId }
    })
    return { catalogItemId: line.catalogItemId, quantity: line.quantity,
      clientLineKey: typeof line.clientLineKey === "string" ? line.clientLineKey.slice(0, 128) : undefined, modifiers }
  })
  if (modifierCount > 200) throw new Error("Too many cart modifiers.")
  if (params.buyerIdentityQr !== undefined && (typeof params.buyerIdentityQr !== "string" || params.buyerIdentityQr.length > 1024)) throw new Error("Invalid account QR.")
  return {
    siteId, source: "shop", selfServiceLocationId: params.selfServiceLocationId,
    originLocationId: params.selfServiceLocationId, fulfillment: params.fulfillment,
    lines, intent: "draft", paymentMethod: "cash", buyerIdentityQr: params.buyerIdentityQr || undefined,
    clientMutationId: params.clientMutationId,
    promotionCode: typeof params.promotionCode === "string" ? params.promotionCode.slice(0, 128) : undefined,
    promotionId: typeof params.promotionId === "string" && UUID.test(params.promotionId) ? params.promotionId : undefined,
    notes: typeof params.notes === "string" ? params.notes.trim().slice(0, 2000) : undefined,
  }
}

export async function prepareSelfServiceCheckout(params: CheckoutCartParams, supabase: CheckoutSupabaseClient) {
  const context = await resolveSelfServiceLocation(params.selfServiceLocationId!, supabase)
  if (!context) throw new Error("Self-service is unavailable at this location.")
  const normalized = normalizeSelfServiceCheckout(params, context.site.id)
  if (!context.fulfillmentOptions.includes(normalized.fulfillment as "pickup" | "dine_in")) throw new Error("This order type is unavailable at this location.")
  const ids = [...new Set(normalized.lines.flatMap((line) => [line.catalogItemId, ...(line.modifiers || []).map((m) => m.catalogItemId)]))]
  const { data: items, error } = await supabase.from("catalog_items")
    .select("id, site_id, kind, status, is_marketplace_listed, is_recurring, is_reservation, is_dynamic_price, metadata, parent_id")
    .eq("site_id", context.site.id).in("id", ids)
  if (error || !items || items.length !== ids.length) throw new Error("Some items are unavailable at this location.")
  const parentIds = [...new Set(items.map((item: { parent_id?: string }) => item.parent_id).filter(Boolean))]
  let parents: typeof items = []
  if (parentIds.length) {
    const result = await supabase.from("catalog_items")
      .select("id, kind, status, is_marketplace_listed, is_recurring, is_reservation, is_dynamic_price, metadata")
      .eq("site_id", context.site.id).in("id", parentIds)
    if (result.error || !result.data) throw new Error("Unable to verify product variants.")
    parents = result.data
  }
  for (const line of normalized.lines) {
    const item = items.find((candidate: { id: string }) => candidate.id === line.catalogItemId)
    const parent = item?.parent_id ? parents.find((candidate: { id: string }) => candidate.id === item.parent_id) : null
    const options = [normalized.fulfillment as "pickup" | "dine_in"]
    const effective = { ...item, metadata: { ...parent?.metadata, ...item?.metadata } }
    if (!item || item.status !== "active" || !(item.is_marketplace_listed || parent?.is_marketplace_listed) ||
      (item.parent_id && (!parent || parent.status !== "active" || !isSelfServiceItem(parent, options, context.location.id))) ||
      !isSelfServiceItem(effective, options, context.location.id)) {
      throw new Error("Some items are unavailable for this order type.")
    }
    for (const modifier of line.modifiers || []) {
      const extra = items.find((candidate: { id: string }) => candidate.id === modifier.catalogItemId)
      const extraParent = extra?.parent_id ? parents.find((candidate: { id: string }) => candidate.id === extra.parent_id) : null
      if (!extra || extra.status !== "active" || !isSelfServiceItem({ ...extra, metadata: { ...extraParent?.metadata, ...extra.metadata } }, options, context.location.id) ||
        (extra.parent_id && (!extraParent || extraParent.status !== "active" || !isSelfServiceItem(extraParent, options, context.location.id)))) throw new Error("Some modifiers are unavailable for this location or order type.")
    }
  }
  await assertSelfServiceModifiers(supabase, context.site.id, normalized.lines, items)
  const buyer = normalized.buyerIdentityQr ? await resolveSelfServiceBuyer(normalized.buyerIdentityQr, supabase) : null
  return { params: { ...normalized, customerName: buyer?.name, customerEmail: buyer?.email }, buyerUserId: buyer?.userId || null }
}