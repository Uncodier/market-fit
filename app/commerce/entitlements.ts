import { createClient, createServiceClient } from "@/lib/supabase/server"
import crypto from "crypto"

export async function grantFromOrder(orderId: string, forceServiceRole: boolean = false) {
  const supabase = await (forceServiceRole ? createServiceClient(true) : createClient())
  
  // 1. Fetch order with items
  const { data: order, error: orderError } = await supabase
    .from('sale_orders')
    .select('*, items')
    .eq('id', orderId)
    .single()
    
  if (orderError || !order) {
    throw new Error(`Failed to fetch order: ${orderError?.message}`)
  }

  if (!order.buyer_user_id) {
    console.warn(`Order ${orderId} has no buyer_user_id. Cannot grant entitlements.`)
    return
  }

  // Check if entitlements already exist for this order
  const { data: existing } = await supabase
    .from('entitlements')
    .select('id')
    .eq('source_type', 'purchase')
    .eq('source_id', order.id)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`Entitlements already granted for order ${orderId}`);
    return
  }

  // 2. Fetch catalog items to identify digital assets
  let orderLines = Array.isArray(order.items) ? order.items : []
  if (orderLines.length === 0) {
    const { data: saleOrderItems } = await supabase
      .from("sale_order_items")
      .select("catalog_item_id, name, quantity")
      .eq("sale_order_id", order.id)
    orderLines = saleOrderItems || []
  }

  const catalogItemIds = orderLines.map((item: any) => item.id || item.catalog_item_id)
  
  if (catalogItemIds.length === 0) return

  const { data: catalogItems } = await supabase
    .from('catalog_items')
    .select('id, kind, digital_subtype, is_recurring, pass_uses, pass_validity_days')
    .in('id', catalogItemIds)

  const digitalItems = catalogItems?.filter((c: any) => c.kind === 'digital_asset') || []
  
  if (digitalItems.length === 0) return

  // 3. Create entitlements
  const entitlements = []
  
  for (const item of orderLines) {
    const itemId = item.id || item.catalog_item_id
    const catalogDef = digitalItems.find((d: any) => d.id === itemId)
    
    if (catalogDef) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        let expiresAt = null;
        if (catalogDef.pass_validity_days) {
          const date = new Date();
          date.setDate(date.getDate() + catalogDef.pass_validity_days);
          expiresAt = date.toISOString();
        }

        let usesTotal = catalogDef.pass_uses || null;
        let usesRemaining = catalogDef.pass_uses || null;
        let metadata: any = {
          order_number: order.order_number,
          name: item.name
        };

        if (catalogDef.digital_subtype === 'ticket' || catalogDef.digital_subtype === 'pass') {
          const token = crypto.randomUUID();
          metadata.access_token = token;
          if (catalogDef.digital_subtype === 'ticket') {
            usesTotal = usesTotal ?? 1;
            usesRemaining = usesRemaining ?? 1;
            metadata.ticket_token = token; // Alias for backward compatibility
          }
        }

        entitlements.push({
          site_id: order.site_id,
          buyer_user_id: order.buyer_user_id,
          owner_site_id: order.owner_site_id,
          catalog_item_id: itemId,
          source_type: 'purchase',
          source_id: order.id,
          status: 'active',
          uses_total: usesTotal,
          uses_remaining: usesRemaining,
          expires_at: expiresAt,
          metadata
        })
      }
    }
  }

  if (entitlements.length > 0) {
    const { error: insertError } = await supabase
      .from('entitlements')
      .insert(entitlements)
      
    if (insertError) {
      throw new Error(`Failed to insert entitlements: ${insertError.message}`)
    }
  }
}

export async function syncSubscriptionEntitlements(subscriptionId: string, forceServiceRole: boolean = false) {
  const supabase = await (forceServiceRole ? createServiceClient(true) : createClient())
  
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
    
  if (subError || !subscription) return

  if (subscription.status !== 'active') {
    await revokeForSubscription(subscriptionId, forceServiceRole)
    return
  }

  if (!subscription.buyer_user_id) return

  // Find plan items
  const { data: planItems } = await supabase
    .from('subscription_plan_items')
    .select('digital_catalog_item_id')
    .eq('plan_catalog_item_id', subscription.catalog_item_id)
    
  if (!planItems || planItems.length === 0) return

  // Check existing entitlements
  const { data: existingEntitlements } = await supabase
    .from('entitlements')
    .select('catalog_item_id')
    .eq('source_type', 'subscription')
    .eq('source_id', subscriptionId)
    .eq('status', 'active')
    
  const existingIds = existingEntitlements?.map((e: any) => e.catalog_item_id) || []
  
  const digitalIdsToFetch = planItems.map((pi: any) => pi.digital_catalog_item_id).filter((id: any) => !existingIds.includes(id));
  
  if (digitalIdsToFetch.length === 0) return;
  
  const { data: digitalCatalogItems } = await supabase
    .from('catalog_items')
    .select('id, digital_subtype, pass_uses, pass_validity_days')
    .in('id', digitalIdsToFetch);
  
  const newEntitlements = []
  for (const digitalId of digitalIdsToFetch) {
    const catalogDef = digitalCatalogItems?.find((c: any) => c.id === digitalId);
    let expiresAt = null;
    if (catalogDef?.pass_validity_days) {
      const date = new Date();
      date.setDate(date.getDate() + catalogDef.pass_validity_days);
      expiresAt = date.toISOString();
    }
    let usesTotal = catalogDef?.pass_uses || null;
    let usesRemaining = catalogDef?.pass_uses || null;
    let metadata: any = {};
    
    if (catalogDef?.digital_subtype === 'ticket' || catalogDef?.digital_subtype === 'pass') {
      const token = crypto.randomUUID();
      metadata.access_token = token;
      if (catalogDef?.digital_subtype === 'ticket') {
        usesTotal = usesTotal ?? 1;
        usesRemaining = usesRemaining ?? 1;
        metadata.ticket_token = token; // Alias for backward compatibility
      }
    }

    newEntitlements.push({
      site_id: subscription.site_id,
      buyer_user_id: subscription.buyer_user_id,
      owner_site_id: subscription.owner_site_id,
      catalog_item_id: digitalId,
      source_type: 'subscription',
      source_id: subscription.id,
      status: 'active',
      uses_total: usesTotal,
      uses_remaining: usesRemaining,
      expires_at: expiresAt,
      metadata
    })
  }
  
  if (newEntitlements.length > 0) {
    await supabase.from('entitlements').insert(newEntitlements)
  }
}

export async function revokeForSubscription(subscriptionId: string, forceServiceRole: boolean = false) {
  const supabase = await (forceServiceRole ? createServiceClient(true) : createClient())
  
  await supabase
    .from('entitlements')
    .update({ 
      status: 'revoked', 
      updated_at: new Date().toISOString() 
    })
    .eq('source_type', 'subscription')
    .eq('source_id', subscriptionId)
    .eq('status', 'active')
}

export async function revokeFromOrder(orderId: string, forceServiceRole: boolean = false) {
  const supabase = await (forceServiceRole ? createServiceClient(true) : createClient())
  
  await supabase
    .from('entitlements')
    .update({ 
      status: 'revoked', 
      updated_at: new Date().toISOString() 
    })
    .eq('source_type', 'purchase')
    .eq('source_id', orderId)
    .in('status', ['active', 'used'])
}

export async function markUsedEntitlement(id: string, forceServiceRole: boolean = false) {
  const supabase = await (forceServiceRole ? createServiceClient(true) : createClient())
  
  const { data, error } = await supabase
    .from('entitlements')
    .update({ 
      status: 'used',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
    
  if (error) {
    throw new Error(`Failed to mark entitlement as used: ${error.message}`)
  }
  
  return { data }
}
