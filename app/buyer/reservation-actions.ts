"use server"

import { createClient } from "@/lib/supabase/server"
import { assertReservationSlot } from "@/app/reservations/availability"
import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details"
import { enrichEntitlementRelations } from "@/app/buyer/entitlement-queries"

export async function completePastBuyerReservations(supabase: any, options: { buyerUserId: string, ownerSiteId?: string }) {
  let query = supabase
    .from("reservations")
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('buyer_user_id', options.buyerUserId)
    .in('status', ['pending', 'confirmed'])
    .lt('end_time', new Date().toISOString())
  
  if (options.ownerSiteId) {
    query = query.eq('owner_site_id', options.ownerSiteId)
  }

  await query
}

export async function getBuyerReservation(id: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      entitlement:entitlements(
        id, uses_remaining, uses_total, status, source_type, source_id,
        catalog_item:catalog_items(
          id, name, image_url, description, digital_subtype, is_recurring, parent_id, metadata,
          raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
        )
      ),
      site:site_id(id, name, logo_url)
    `)
    .eq("id", id)
    .eq("buyer_user_id", session.user.id)
    .single()

  if (error) {
    console.error("getBuyerReservation:", error)
    return { error: error.message }
  }
  if (!data) return { error: "Reservation not found" }

  // Auto-complete if end_time has passed
  if (['pending', 'confirmed'].includes(data.status) && new Date(data.end_time) < new Date()) {
    data.status = 'completed'
    await supabase
      .from("reservations")
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq("id", id)
  }

  // Prefer full PDP item; fall back to a direct catalog read so manage page still loads
  let item: any = null
  try {
    const { getPdpCatalogItem } = await import("@/app/commerce/pdp-actions")
    item = await getPdpCatalogItem(data.catalog_item_id, { siteId: data.site_id })
  } catch (e) {
    console.error("getBuyerReservation getPdpCatalogItem failed:", e)
  }

  if (!item) {
    const { data: catalogItem, error: itemError } = await supabase
      .from("catalog_items")
      .select(`
        *,
        raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
      `)
      .eq("id", data.catalog_item_id)
      .single()

    if (itemError || !catalogItem) {
      console.error("getBuyerReservation catalog fallback:", itemError)
      return { error: "Catalog item not found" }
    }

    item = {
      ...catalogItem,
      item_specs: ((catalogItem as any).raw_specs || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((cis: any) => cis.item_spec)
        .filter(Boolean),
    }

    if (catalogItem.parent_id) {
      const { data: parentRow } = await supabase
        .from("catalog_items")
        .select(`
          *,
          raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
        `)
        .eq("id", catalogItem.parent_id)
        .maybeSingle()

      if (parentRow) {
        item = mergeParentIntoCatalogItem(item, {
          ...parentRow,
          item_specs: ((parentRow as any).raw_specs || [])
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((cis: any) => cis.item_spec)
            .filter(Boolean),
        })
      }
    }
  }

  if (data.entitlement?.catalog_item && (data.entitlement.catalog_item as any).raw_specs) {
    data.entitlement.catalog_item.item_specs = ((data.entitlement.catalog_item as any).raw_specs || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((cis: any) => cis.item_spec)
      .filter(Boolean)
  }

  const entitlement = await enrichEntitlementRelations(supabase, data.entitlement)

  if (item && entitlement) {
    const parentSpecs = entitlement.subscription?.catalog_item?.item_specs || entitlement.catalog_item?.item_specs || []
    
    // Merge them into item.item_specs if not already present
    if (parentSpecs.length > 0) {
      const childSlugs = new Set((item.item_specs || []).map((s: any) => s.category?.slug).filter(Boolean))
      const missingSpecs = parentSpecs.filter((s: any) => s.category?.slug && !childSlugs.has(s.category.slug))
      
      item.item_specs = [...(item.item_specs || []), ...missingSpecs]
    }
  }

  return {
    data: {
      ...data,
      entitlement,
      catalog_item: item,
    },
  }
}

export async function cancelBuyerReservation(id: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return { error: "Not authenticated" }

  // 1. Get the reservation to check ownership and status
  const { data: reservation, error: getError } = await supabase
    .from("reservations")
    .select("*, entitlement:entitlements(id, uses_remaining, uses_total, status)")
    .eq("id", id)
    .eq("buyer_user_id", session.user.id)
    .single()

  if (getError || !reservation) return { error: "Reservation not found or unauthorized" }

  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    return { error: `Cannot cancel a ${reservation.status} reservation` }
  }

  const isPast = new Date(reservation.start_time) < new Date()
  if (isPast) {
    return { error: "Cannot cancel a past reservation" }
  }

  // 2. Update status to cancelled
  const { error: cancelError } = await supabase
    .from("reservations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)

  if (cancelError) return { error: cancelError.message }

  // 3. Restore pass uses if it came from an entitlement with limited uses
  if (reservation.entitlement_id && reservation.entitlement) {
    const ent = reservation.entitlement
    if (ent.uses_total !== null && ent.uses_remaining !== null) {
      const quantityToRestore = reservation.quantity || 1
      const newUses = Math.min(ent.uses_total, ent.uses_remaining + quantityToRestore)
      
      let newStatus = ent.status
      if (ent.status === 'used' && newUses > 0) {
        newStatus = 'active'
      }

      await supabase
        .from("entitlements")
        .update({
          uses_remaining: newUses,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", ent.id)
    }
  }

  return { success: true }
}

export async function rescheduleBuyerReservation({ id, startIso, endIso }: { id: string, startIso: string, endIso: string }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return { error: "Not authenticated" }

  // 1. Get the reservation
  const { data: reservation, error: getError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("buyer_user_id", session.user.id)
    .single()

  if (getError || !reservation) return { error: "Reservation not found or unauthorized" }

  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    return { error: `Cannot reschedule a ${reservation.status} reservation` }
  }

  const isPast = new Date(reservation.start_time) < new Date()
  if (isPast) {
    return { error: "Cannot reschedule a past reservation" }
  }

  try {
    // 2. Assert the new slot is available
    // Pass ignoreReservationId to not count this reservation against the limit
    await assertReservationSlot(
      reservation.site_id,
      reservation.catalog_item_id,
      startIso,
      endIso,
      reservation.quantity || 1,
      false,
      reservation.id // Need to update assertReservationSlot to support ignoring an ID if it doesn't already
    )
  } catch (err: any) {
    return { error: err.message || "Time slot is no longer available" }
  }

  // 3. Update reservation time
  const { error: updateError } = await supabase
    .from("reservations")
    .update({ 
      start_time: startIso, 
      end_time: endIso, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)

  if (updateError) return { error: updateError.message }

  return { success: true }
}