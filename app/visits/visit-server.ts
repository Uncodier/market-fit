import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildVisitResourcePayload, dataUrlToBuffer } from "./visit-helpers"

export async function requireVisitUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" as const, supabase, user: null }
  return { supabase, user, error: null }
}

export async function requireSiteMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  userId: string
) {
  const { data: membership } = await supabase
    .from("site_members")
    .select("status")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!membership || membership.status !== "active") {
    const { data: site } = await supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle()
    if (site?.user_id !== userId) return { error: "Not authorized for this site" }
  }
  return { error: null }
}

export async function uploadAttestation(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  reservationId: string,
  kind: "signature" | "photo" | "id",
  dataUrl: string
) {
  const parsed = dataUrlToBuffer(dataUrl)
  if ("error" in parsed) return { error: parsed.error }

  // Use service role after caller auth checks — buyers are not site_members.
  const admin = await createServiceClient(true)
  const path = `${siteId}/${reservationId}/${kind}.${parsed.ext}`
  const { error } = await admin.storage.from("visit-attestations").upload(path, parsed.buffer, {
    contentType: parsed.contentType,
    upsert: true,
  })
  if (error) return { error: error.message }

  const { data } = admin.storage.from("visit-attestations").getPublicUrl(path)
  return { url: data?.publicUrl || path, path }
}

export async function validateVisitResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  resource: Exclude<ReturnType<typeof buildVisitResourcePayload>, { error: string }>
) {
  if (resource.resource_type === "catalog_item" && resource.catalog_item_id) {
    const { data } = await supabase
      .from("catalog_items")
      .select("id, is_reservation, site_id")
      .eq("id", resource.catalog_item_id)
      .eq("site_id", siteId)
      .maybeSingle()
    if (!data?.is_reservation) return { error: "Invalid reservable service" }
  }

  if (resource.resource_type === "location" && resource.location_id) {
    const { data } = await supabase
      .from("locations")
      .select("id, is_active")
      .eq("id", resource.location_id)
      .eq("site_id", siteId)
      .maybeSingle()
    if (!data || data.is_active === false) return { error: "Invalid location" }
  }

  if (resource.resource_type === "employee" && resource.assignee_user_id) {
    const { data: member } = await supabase
      .from("site_members")
      .select("user_id")
      .eq("site_id", siteId)
      .eq("user_id", resource.assignee_user_id)
      .eq("status", "active")
      .maybeSingle()
    const { data: site } = await supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle()
    if (!member && site?.user_id !== resource.assignee_user_id) {
      return { error: "Invalid employee" }
    }
  }

  return { error: null }
}

export async function consumeVisitEntitlement(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  siteId: string
  entitlementId: string
  catalogItemId?: string | null
  quantity?: number
}) {
  const { supabase, siteId, entitlementId, catalogItemId, quantity = 1 } = params
  const { data: entitlement, error } = await supabase
    .from("entitlements")
    .select("*, catalog_item:catalog_items(id, kind, digital_subtype)")
    .eq("id", entitlementId)
    .eq("site_id", siteId)
    .single()

  if (error || !entitlement) return { error: "Entitlement not found" }
  if (entitlement.status !== "active") return { error: `Cannot use a ${entitlement.status} entitlement` }
  if (entitlement.expires_at && new Date(entitlement.expires_at) < new Date()) {
    return { error: "This pass has expired" }
  }
  if (entitlement.uses_remaining !== null && entitlement.uses_remaining < quantity) {
    return { error: "Not enough uses remaining on this pass" }
  }

  const item = entitlement.catalog_item as any
  if (item?.kind === "digital_asset" && item?.digital_subtype === "pass" && catalogItemId) {
    const { data: redeemable } = await supabase
      .from("pass_redeemable_items")
      .select("id")
      .eq("pass_catalog_item_id", entitlement.catalog_item_id)
      .eq("reservable_catalog_item_id", catalogItemId)
      .maybeSingle()
    if (!redeemable) return { error: "This pass cannot be used for this service" }
  }

  if (entitlement.uses_remaining !== null) {
    const newUses = entitlement.uses_remaining - quantity
    const { error: updError } = await supabase
      .from("entitlements")
      .update({ uses_remaining: newUses, status: newUses <= 0 ? "used" : "active" })
      .eq("id", entitlement.id)
    if (updError) return { error: updError.message }
  }

  return { entitlement }
}
