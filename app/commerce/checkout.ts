"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanSell } from "@/app/catalog/actions";
import { resolveUnitPrice } from "@/app/price-lists/actions";
import { applyPromotionToOrder } from "@/app/promotions/actions";
import { createShipment } from "@/app/shipments/actions";

export interface CheckoutLine {
  catalogItemId: string;
  quantity: number;
}

export interface CheckoutCartParams {
  siteId: string;
  lines: CheckoutLine[];
  priceListId?: string;
  leadId?: string;
  promotionCode?: string;
  fulfillment: 'pickup' | 'ship' | 'dine_in' | 'none';
  originLocationId?: string; // required if fulfillment is 'ship'
  shippingAddress?: any;
  source: 'pos' | 'shop' | 'sales';
  userId?: string;
  customerName?: string; // Used if creating lead on the fly for shop
  customerEmail?: string;
}

export async function checkoutCart({
  siteId,
  lines,
  priceListId,
  leadId,
  promotionCode,
  fulfillment,
  originLocationId,
  shippingAddress,
  source,
  userId,
  customerName,
  customerEmail
}: CheckoutCartParams) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient(true);
    
    // For shop, userId is undefined, so we need to get the site's user_id
    let resolvedUserId = userId;
    if (source === 'shop' && !resolvedUserId) {
      const { data: site } = await supabaseAdmin.from("sites").select("user_id").eq("id", siteId).single();
      if (site) resolvedUserId = site.user_id;
    }

    if (!lines || lines.length === 0) throw new Error("Cart is empty");

    // 1. Resolve Lead (Create if shop and no leadId but has email)
    let finalLeadId = leadId;
    if (!finalLeadId && customerEmail && customerName) {
      const { data: existing } = await (source === 'shop' ? supabaseAdmin : supabase)
        .from("leads")
        .select("id")
        .eq("site_id", siteId)
        .eq("email", customerEmail)
        .single();
        
      if (existing) {
        finalLeadId = existing.id;
      } else {
        const { data: newLead } = await (source === 'shop' ? supabaseAdmin : supabase)
          .from("leads")
          .insert({ site_id: siteId, name: customerName, email: customerEmail, status: 'new', user_id: resolvedUserId })
          .select("id")
          .single();
        if (newLead) finalLeadId = newLead.id;
      }
    }

    // 2. Resolve default price list if lead has one
    let finalPriceListId = priceListId;
    if (!finalPriceListId && finalLeadId) {
      const { data: lead } = await (source === 'shop' ? supabaseAdmin : supabase).from("leads").select("default_price_list_id").eq("id", finalLeadId).single();
      if (lead?.default_price_list_id) {
        finalPriceListId = lead.default_price_list_id;
      }
    }

    // 3. Process Lines (Verify Stock & Resolve Prices)
    let orderSubtotal = 0;
    const processedLines = [];
    
    for (const line of lines) {
      // Assert can sell
      await assertCanSell(siteId, line.catalogItemId, line.quantity, originLocationId, source === 'shop');
      
      // Resolve price
      const { price } = await resolveUnitPrice(siteId, line.catalogItemId, finalPriceListId, source === 'shop');
      
      const { data: catalogItem } = await (source === 'shop' ? supabaseAdmin : supabase).from("catalog_items").select("name, description").eq("id", line.catalogItemId).single();
      
      const subtotal = price * line.quantity;
      orderSubtotal += subtotal;
      
      processedLines.push({
        site_id: siteId,
        catalog_item_id: line.catalogItemId,
        name: catalogItem?.name || "Unknown Item",
        description: catalogItem?.description,
        quantity: line.quantity,
        unit_price: price,
        subtotal: subtotal
      });
    }

    // 4. Create Sale
    const saleData: any = {
      site_id: siteId,
      lead_id: finalLeadId,
      title: `Order - ${new Date().toLocaleDateString()}`,
      status: fulfillment === 'none' || fulfillment === 'dine_in' || fulfillment === 'pickup' ? 'completed' : 'pending',
      amount: orderSubtotal,
      amount_due: orderSubtotal,
      user_id: resolvedUserId,
      sale_date: new Date().toISOString().split('T')[0],
      source: source === 'shop' ? 'online' : 'retail'
    };

    const { data: sale, error: saleError } = await (source === 'shop' ? supabaseAdmin : supabase)
      .from("sales")
      .insert(saleData)
      .select()
      .single();

    if (saleError) throw new Error(`Sale error: ${saleError.message}`);

    // 5. Create Sale Order
    const orderData: any = {
      site_id: siteId,
      sale_id: sale.id,
      price_list_id: finalPriceListId,
      subtotal: orderSubtotal,
      total: orderSubtotal,
      discount_total: 0,
      status: 'pending', // payment status
      order_number: `ORD-${Date.now().toString().slice(-6)}`,
      user_id: resolvedUserId,
      items: processedLines.map(pl => ({
        id: pl.catalog_item_id,
        name: pl.name,
        quantity: pl.quantity,
        unitPrice: pl.unit_price,
        subtotal: pl.subtotal
      }))
    };

    const { data: order, error: orderError } = await (source === 'shop' ? supabaseAdmin : supabase)
      .from("sale_orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError) throw new Error(`Order error: ${orderError.message}`);

    // 6. Insert Order Items
    const itemsToInsert = processedLines.map(pl => ({ ...pl, sale_order_id: order.id }));
    const { error: orderItemsError } = await (source === 'shop' ? supabaseAdmin : supabase).from("sale_order_items").insert(itemsToInsert);
    if (orderItemsError) throw new Error(`Order items error: ${orderItemsError.message}`);

    // 6.b Update order JSONB items for backwards compatibility in UI until UI uses sale_order_items
    await (source === 'shop' ? supabaseAdmin : supabase).from("sale_orders").update({ items: orderData.items }).eq("id", order.id);

    // 7. Apply Promotion (if provided)
    if (promotionCode) {
      const { data: orderWithPromo } = await (source === 'shop' ? supabaseAdmin : supabase).from("sale_orders").select("promotion_id").eq("id", order.id).single();
      
      if (!orderWithPromo?.promotion_id) {
        const promoResult = await applyPromotionToOrder(siteId, order.id, promotionCode, source === 'shop');
        if (promoResult.error) {
          throw new Error(`Promotion failed: ${promoResult.error}`);
        }
      }
    }

    // 8. Create Shipment (if ship)
    if (fulfillment === 'ship' && originLocationId && resolvedUserId) {
      const shipResult = await createShipment({
        siteId,
        saleOrderId: order.id,
        saleId: sale.id,
        leadId: finalLeadId,
        originLocationId,
        shippingAddress,
        userId: resolvedUserId,
        forceServiceRole: source === 'shop'
      });
      if (shipResult.error) throw new Error(`Shipment error: ${shipResult.error}`);
    } else if (originLocationId) {
      // Non-ship fulfillments (pickup, dine_in, none) are marked completed immediately.
      // Therefore, if policy is NOT 'never', we should decrement stock now since the order is finalized.
      const { data: settings } = await (source === 'shop' ? supabaseAdmin : supabase).from("settings").select("commerce").eq("site_id", siteId).single();
      const policy = settings?.commerce?.decrement_stock_on || 'ship';
      
      if (policy !== 'never') {
        for (const line of lines) {
          const { data: catItem } = await (source === 'shop' ? supabaseAdmin : supabase).from("catalog_items").select("track_inventory").eq("id", line.catalogItemId).single();
          if (catItem?.track_inventory) {
            const { data: level } = await (source === 'shop' ? supabaseAdmin : supabase).from("inventory_levels")
              .select("id, quantity")
              .eq("catalog_item_id", line.catalogItemId)
              .eq("location_id", originLocationId)
              .single();
            if (level) {
              const newQty = Math.max(0, level.quantity - line.quantity);
              await (source === 'shop' ? supabaseAdmin : supabase).from("inventory_levels").update({ quantity: newQty }).eq("id", level.id);
            } else {
              await (source === 'shop' ? supabaseAdmin : supabase).from("inventory_levels").insert({
                site_id: siteId,
                location_id: originLocationId,
                catalog_item_id: line.catalogItemId,
                quantity: Math.max(0, -line.quantity) // floor at 0
              });
            }
          }
        }
      }
    }

    return { success: true, saleId: sale.id, orderId: order.id };
  } catch (error: any) {
    return { error: error.message };
  }
}
