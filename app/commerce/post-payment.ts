import { createServiceClient } from "@/lib/supabase/server"
import { createShipment } from "@/app/shipments/actions"
import { ensureCommerceLeadConverted } from "./ensure-commerce-lead-converted"
import { grantFromOrder } from "./entitlements"

export async function processPostPaymentFulfillment(
  orderId: string, 
  siteId: string, 
  saleId: string, 
  leadId: string | undefined, 
  userId: string
) {
  const supabase = await createServiceClient(true)

  try {
    const saleResult = await supabase
      .from("sales")
      .select("lead_id, source, amount")
      .eq("id", saleId)
      .single()

    const sale = saleResult?.data
    const resolvedLeadId = sale?.lead_id || leadId
    if (resolvedLeadId && userId) {
      await ensureCommerceLeadConverted({
        supabase,
        siteId,
        leadId: resolvedLeadId,
        source: sale?.source || "",
        userId,
        amount: sale?.amount ?? null,
        paid: true,
      })
    }
  } catch (e) {
    console.error("Failed to sync commerce lead conversion after payment:", e)
  }

  // 1. Load order fulfillment fields and line items
  const { data: order } = await supabase
    .from('sale_orders')
    .select('items, fulfillment_method, origin_location_id, shipping_address, buyer_user_id')
    .eq('id', orderId)
    .single()
    
  if (!order) return

  const { data: saleOrderItems } = await supabase
    .from('sale_order_items')
    .select('id, catalog_item_id, quantity')
    .eq('sale_order_id', orderId)

  // 2. Confirm pending reservations tied to this order
  if (saleOrderItems && saleOrderItems.length > 0) {
    await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .in('sale_order_item_id', saleOrderItems.map(i => i.id))
      .eq('status', 'pending');
  }

  // 3. Promote line items
  const fulfillmentMethod = order.fulfillment_method || 'none';
  const newStatus = fulfillmentMethod === 'none' ? 'completed' : 'new';
  const sentAt = new Date().toISOString();

  if (saleOrderItems && saleOrderItems.length > 0) {
    await supabase
      .from('sale_order_items')
      .update({ status: newStatus, sent_at: sentAt })
      .in('id', saleOrderItems.map(i => i.id))
      .eq('status', 'draft'); // Only promote draft items
  }

  // Card checkouts start as draft; entitlements are only granted once paid.
  try {
    await grantFromOrder(orderId, true)
  } catch (e) {
    console.error("Failed to grant entitlements after payment:", e)
  }

  // 4. Create shipment if applicable
  let shipmentId: string | undefined;
  if (fulfillmentMethod === 'ship' && order.origin_location_id && order.shipping_address) {
    const shipResult = await createShipment({
      siteId,
      saleOrderId: orderId,
      saleId,
      leadId: leadId || undefined,
      originLocationId: order.origin_location_id,
      shippingAddress: order.shipping_address,
      userId,
      forceServiceRole: true
    });

    if (shipResult.data?.id) {
      shipmentId = shipResult.data.id;
      // Attach shipment ID to the promoted line items
      if (saleOrderItems && saleOrderItems.length > 0) {
        await supabase
          .from('sale_order_items')
          .update({ shipment_id: shipmentId })
          .in('id', saleOrderItems.map(i => i.id));
      }
    }
  }

  // 5. Decrement inventory from origin_location_id
  if (!order.items || !order.origin_location_id) return;
  
  const { data: settings } = await supabase.from("settings").select("commerce").eq("site_id", siteId).single()
  const policy = settings?.commerce?.decrement_stock_on || 'ship'
  
  if (policy === 'never') return

  for (const item of order.items) {
    const catalogItemId = item.id || item.catalog_item_id
    if (!catalogItemId) continue

    const { data: catItem } = await supabase.from("catalog_items").select("track_inventory").eq("id", catalogItemId).single()
    
    if (catItem?.track_inventory) {
      const { data: level } = await supabase.from("inventory_levels")
        .select("id, quantity")
        .eq("catalog_item_id", catalogItemId)
        .eq("location_id", order.origin_location_id)
        .single()

      if (level) {
        const newQty = Math.max(0, level.quantity - (item.quantity || 1))
        await supabase.from("inventory_levels").update({ quantity: newQty }).eq("id", level.id)
      } else {
        await supabase.from("inventory_levels").insert({
          site_id: siteId,
          location_id: order.origin_location_id,
          catalog_item_id: catalogItemId,
          quantity: Math.max(0, -(item.quantity || 1)) // floor at 0
        })
      }
    }
  }
}
