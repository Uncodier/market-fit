"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details"

export async function enrichEntitlementRelations(supabase: any, entitlement: any) {
  if (!entitlement) return entitlement

  const next = { ...entitlement }

  if (entitlement.source_type === "subscription" && entitlement.source_id) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(`
        id, status, amount, start_date, next_billing_date, 
        catalog_item:catalog_items(
          id, name, image_url, description, is_recurring, metadata,
          raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
        )
      `)
      .eq("id", entitlement.source_id)
      .maybeSingle()
    if (subscription) {
      if (subscription.catalog_item) {
        subscription.catalog_item.item_specs = ((subscription.catalog_item as any).raw_specs || [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((cis: any) => cis.item_spec)
          .filter(Boolean)
      }
      next.subscription = subscription
    }
  }

  const passItem = entitlement.catalog_item
  if (passItem?.parent_id) {
    const { data: parentRow } = await supabase
      .from("catalog_items")
      .select(`
        *,
        raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
      `)
      .eq("id", passItem.parent_id)
      .maybeSingle()

    if (parentRow) {
      next.catalog_item = mergeParentIntoCatalogItem(passItem, {
        ...parentRow,
        item_specs: ((parentRow as any).raw_specs || [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((cis: any) => cis.item_spec)
          .filter(Boolean),
      })
    }
  }

  return next
}

export async function getEntitlementById(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseService = await createServiceClient(true)

  const { data } = await supabaseService
    .from('entitlements')
    .select('*, catalog_item:catalog_items(*), site:site_id(id, name, logo_url)')
    .eq('id', id)
    .eq('buyer_user_id', user.id)
    .maybeSingle()

  if (!data) return null
  return enrichEntitlementRelations(supabase, data)
}

export async function getActiveDigitalEntitlementForCatalogItem(catalogItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date().toISOString()
  
  const { data } = await supabase
    .from('entitlements')
    .select('*')
    .eq('catalog_item_id', catalogItemId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)
    .maybeSingle()

  return data
}

export async function getActivePassEntitlementForCatalogItem(catalogItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date().toISOString()
  
  const { data } = await supabase
    .from('entitlements')
    .select('*')
    .eq('catalog_item_id', catalogItemId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`uses_remaining.is.null,uses_remaining.gt.0`)
    .limit(1)
    .maybeSingle()

  return data
}

export async function getActivePassEntitlementForPlanOrPass(catalogItemId: string) {
  // First, check if there's a direct pass entitlement for this ID (standalone pass purchase)
  const passEntitlement = await getActivePassEntitlementForCatalogItem(catalogItemId)
  if (passEntitlement) {
    return passEntitlement
  }

  // If not found, maybe it's a recurring plan that granted a pass via subscription_plan_items
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date().toISOString()

  // Find all digital items this plan grants
  const { data: planItems } = await supabase
    .from('subscription_plan_items')
    .select('digital_catalog_item_id')
    .eq('plan_catalog_item_id', catalogItemId)

  if (!planItems || planItems.length === 0) return null

  const digitalItemIds = planItems.map((pi: any) => pi.digital_catalog_item_id).filter(Boolean)
  if (digitalItemIds.length === 0) return null

  // Find an active entitlement on any of those granted digital items
  // Prefer passes with uses_remaining > 0
  const { data } = await supabase
    .from('entitlements')
    .select('*, catalog_item:catalog_items(kind, digital_subtype)')
    .in('catalog_item_id', digitalItemIds)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`uses_remaining.is.null,uses_remaining.gt.0`)
    
  if (!data || data.length === 0) return null

  // We want to return an entitlement that is a 'pass' so the book pass page works
  const passEnt = data.find((e: any) => e.catalog_item?.digital_subtype === 'pass')
  if (passEnt) {
    // Strip the joined relation to keep the signature consistent
    delete passEnt.catalog_item
    return passEnt
  }

  // Fallback to the first active entitlement (maybe it's a course/file but we are on PassPdpLayout)
  const first = data[0]
  delete first.catalog_item
  return first
}

export async function resolveBookableAccess(catalogItemId: string, isItemReservation: boolean) {
  const entitlement = await getActivePassEntitlementForPlanOrPass(catalogItemId);
  if (!entitlement) return { entitlement: null, canBook: false };

  const supabase = await createClient();
  const { count } = await supabase
    .from('pass_redeemable_items')
    .select('id', { count: 'exact', head: true })
    .eq('pass_catalog_item_id', entitlement.catalog_item_id);

  const hasRedeemables = (count || 0) > 0;
  // Book when the item itself is reservable (plan-as-calendar) or the pass links to any redeemable
  return { entitlement, canBook: isItemReservation || hasRedeemables, redeemableCount: count || 0 };
}

export async function getActivePassEntitlementForReservable(reservableCatalogItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date().toISOString()

  // First get all valid passes for the user
  const { data: userPasses } = await supabase
    .from('entitlements')
    .select('id, catalog_item_id, uses_remaining')
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`uses_remaining.is.null,uses_remaining.gt.0`)

  if (!userPasses || userPasses.length === 0) return null

  // Check if any of these passes map to the reservable item
  const passCatalogItemIds = userPasses.map((p: any) => p.catalog_item_id)

  const { data: mapping } = await supabase
    .from('pass_redeemable_items')
    .select('pass_catalog_item_id')
    .eq('reservable_catalog_item_id', reservableCatalogItemId)
    .in('pass_catalog_item_id', passCatalogItemIds)
    .limit(1)
    .single()

  if (mapping) {
    const entitlement = userPasses.find((p: any) => p.catalog_item_id === mapping.pass_catalog_item_id)
    // Refetch the full entitlement to return
    if (entitlement) {
      const { data } = await supabase
        .from('entitlements')
        .select('*')
        .eq('id', entitlement.id)
        .single()
      return data
    }
  }

  return null
}