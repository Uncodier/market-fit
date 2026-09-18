import { createServiceClient } from "@/lib/supabase/server"
import { createShipment } from "@/app/shipments/actions"
import { ensureCommerceLeadConverted } from "./ensure-commerce-lead-converted"
import { grantFromOrder } from "./entitlements"

type PaidOrderItem = {
  id: string
  catalog_item_id: string | null
  quantity: number
}

export async function processPostPaymentFulfillment(
  orderId: string, 
  siteId: string, 
  saleId: string, 
  leadId: string | undefined, 
  userId: string,
  options?: {
    stripeSessionId?: string
    fulfillmentClaimToken?: string
  },
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
  const { data: order, error: orderError } = await supabase
    .from('sale_orders')
    .select('items, fulfillment_method, origin_location_id, shipping_address, buyer_user_id')
    .eq('id', orderId)
    .single()
    
  if (orderError || !order) {
    throw new Error(`Failed to load paid order: ${orderError?.message}`)
  }

  const { data: saleOrderItems, error: itemsError } = await supabase
    .from('sale_order_items')
    .select('id, catalog_item_id, quantity')
    .eq('sale_order_id', orderId)
  if (itemsError) {
    throw new Error(`Failed to load paid order items: ${itemsError.message}`)
  }
  const paidOrderItems = (saleOrderItems || []) as PaidOrderItem[]

  // 2. Confirm pending reservations tied to this order
  if (paidOrderItems.length > 0) {
    const { error: reservationError } = await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .in('sale_order_item_id', paidOrderItems.map((item) => item.id))
      .eq('status', 'pending');
    if (reservationError) {
      throw new Error(
        `Failed to confirm paid reservations: ${reservationError.message}`,
      )
    }
  }

  // 3. Promote line items
  const fulfillmentMethod = order.fulfillment_method || 'none';
  const newStatus = fulfillmentMethod === 'none' ? 'completed' : 'new';
  const sentAt = new Date().toISOString();

  if (paidOrderItems.length > 0) {
    const { error: itemUpdateError } = await supabase
      .from('sale_order_items')
      .update({ status: newStatus, sent_at: sentAt })
      .in('id', paidOrderItems.map((item) => item.id))
      .eq('status', 'draft'); // Only promote draft items
    if (itemUpdateError) {
      throw new Error(
        `Failed to promote paid order items: ${itemUpdateError.message}`,
      )
    }
  }

  // Card checkouts start as draft; entitlements are only granted once paid.
  await grantFromOrder(orderId, true)

  // 4. Create shipment if applicable
  let shipmentId: string | undefined;
  if (fulfillmentMethod === 'ship' && order.origin_location_id && order.shipping_address) {
    const { data: existingShipment, error: shipmentLookupError } = await supabase
      .from("shipments")
      .select("id")
      .eq("sale_order_id", orderId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (shipmentLookupError) {
      throw new Error(
        `Failed to check paid order shipment: ${shipmentLookupError.message}`,
      )
    }

    shipmentId = existingShipment?.id
    if (!shipmentId) {
      const shipResult = await createShipment({
        siteId,
        saleOrderId: orderId,
        saleId,
        leadId: leadId || undefined,
        originLocationId: order.origin_location_id,
        shippingAddress: order.shipping_address,
        userId,
        forceServiceRole: true,
        stripeCheckoutSessionId: options?.stripeSessionId,
      });
      if (shipResult.error || !shipResult.data?.id) {
        throw new Error(
          `Failed to create paid order shipment: ${
            shipResult.error || "missing shipment"
          }`,
        )
      }
      shipmentId = shipResult.data.id;
    }

    if (paidOrderItems.length > 0) {
      const { error: shipmentAttachError } = await supabase
        .from('sale_order_items')
        .update({ shipment_id: shipmentId })
        .in('id', paidOrderItems.map((item) => item.id));
      if (shipmentAttachError) {
        throw new Error(
          `Failed to attach paid shipment: ${shipmentAttachError.message}`,
        )
      }
    }
  }

  if (options?.stripeSessionId || options?.fulfillmentClaimToken) {
    if (!options.stripeSessionId || !options.fulfillmentClaimToken) {
      throw new Error("Stripe fulfillment ownership is incomplete")
    }
    const { data, error } = await supabase.rpc(
      "apply_stripe_sale_inventory_effect",
      {
        p_sale_id: saleId,
        p_order_id: orderId,
        p_session_id: options.stripeSessionId,
        p_claim_token: options.fulfillmentClaimToken,
      },
    )
    const status =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>).status
        : null
    if (
      error ||
      (status !== "completed" && status !== "already_completed")
    ) {
      throw new Error(
        `Failed to apply paid inventory effect: ${
          error?.message || "invalid response"
        }`,
      )
    }
    return
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
