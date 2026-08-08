"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanSell } from "@/app/catalog/actions";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { resolveUnitPrice } from "@/app/price-lists/actions";
import { applyPromotionToOrder } from "@/app/promotions/actions";
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion";
import { createShipment } from "@/app/shipments/actions";
import { assertReservationSlot } from "@/app/reservations/availability";
import { grantFromOrder, syncSubscriptionEntitlements } from "./entitlements";
import { calculateOrderTaxTotal, roundMoney } from "./taxes";

export interface CheckoutLine {
  catalogItemId: string;
  quantity: number;
  unitPriceOverride?: number; // Used for quotes to honor the quoted price
  reservationStart?: string; // ISO
  reservationEnd?: string;   // ISO
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
  source: 'pos' | 'shop' | 'sales' | 'marketplace' | 'quote';
  userId?: string;
  buyerUserId?: string;
  ownerSiteId?: string | null;
  customerName?: string; // Used if creating lead on the fly for shop
  customerEmail?: string;
  payments?: { method: string; amount: number; tendered?: number; change?: number }[];
  existingOrderId?: string;
  intent?: 'draft' | 'send' | 'complete' | 'pay';
  paymentMethod?: string; // legacy/passthrough
  scheduledFor?: string; // ISO
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
  buyerUserId,
  ownerSiteId,
  customerName,
  customerEmail,
  payments,
  existingOrderId,
  intent,
  paymentMethod,
  scheduledFor
}: CheckoutCartParams) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient(true);
    
    const isAdmin = ['shop', 'marketplace', 'quote'].includes(source);
    
    // For shop, userId is undefined, so we need to get the site's user_id
    let resolvedUserId = userId;
    let siteSettings: any = null;
    
    if (isAdmin) {
      const { data: site } = await supabaseAdmin.from("sites").select("user_id, settings").eq("id", siteId).single();
      if (site) {
        resolvedUserId = resolvedUserId || site.user_id;
        siteSettings = site.settings;
      }
    } else {
      // Pos or sales, fetch site anyway to validate locations / business hours
      const { data: site } = await supabaseAdmin.from("sites").select("settings").eq("id", siteId).single();
      if (site) {
        siteSettings = site.settings;
      }
    }

    // Location & timing validation
    if (siteSettings) {
      // 1. Validate location restrictions
      const { evaluateLocationRestrictions } = await import('./location-restrictions');
      if (fulfillment === 'ship' && shippingAddress?.city && shippingAddress?.zip) {
        const restrictions = siteSettings.locations || [];
        const res = evaluateLocationRestrictions(restrictions, shippingAddress);
        if (!res.available) {
          throw new Error('Service is not available in the provided shipping address area.');
        }
      }

      // 2. Validate business hours
      const { isBusinessOpen } = await import('./business-hours');
      const businessHours = siteSettings.business_hours || [];
      if (businessHours.length > 0) {
        if (!scheduledFor && !isBusinessOpen(businessHours)) {
          throw new Error('Store is currently closed. Please select a time to schedule your order.');
        }
        if (scheduledFor && !isBusinessOpen(businessHours, new Date(scheduledFor))) {
          throw new Error('The selected scheduled time is outside business hours.');
        }
      }
    }

    if (!lines || lines.length === 0) throw new Error("Cart is empty");

    // Check if there are any digital or recurring items, which require a buyerUserId
    const lineCatalogItemIds = lines.map(l => l.catalogItemId);
    const { data: catItemsForCheck, error: itemsError } = await (isAdmin ? supabaseAdmin : supabase)
      .from("catalog_items")
      .select("id, kind, is_recurring, metadata")
      .in("id", lineCatalogItemIds);
      
    if (itemsError) throw new Error(itemsError.message);
    if (!catItemsForCheck || catItemsForCheck.length === 0) throw new Error("No items found");

    const hasDigitalOrRecurring = catItemsForCheck.some((c: any) => c.kind === 'digital_asset' || c.is_recurring);
    if (hasDigitalOrRecurring && !buyerUserId && (source === 'shop' || source === 'marketplace' || source === 'quote')) {
      throw new Error("You must be logged in to purchase digital assets or subscriptions.");
    }

    // Validate fulfillment against allowed options
    const {
      getItemDeliveryOptions,
      isFulfillmentAllowed,
      intersectPickupLocationIds,
    } = await import('./delivery-options');
    const itemsWithOptions = catItemsForCheck.map((item: any) => ({ allowed: getItemDeliveryOptions(item) }));
    if (!isFulfillmentAllowed(fulfillment as any, itemsWithOptions)) {
      throw new Error(`Fulfillment method '${fulfillment}' is not allowed for the items in this cart.`);
    }

    const pickupLocationRestriction = fulfillment === 'pickup'
      ? intersectPickupLocationIds(catItemsForCheck)
      : null;
    if (fulfillment === 'pickup' && pickupLocationRestriction && pickupLocationRestriction.length === 0) {
      throw new Error('No compatible pickup locations for the items in this cart.');
    }
    if (
      fulfillment === 'pickup' &&
      originLocationId &&
      pickupLocationRestriction &&
      !pickupLocationRestriction.includes(originLocationId)
    ) {
      throw new Error('Selected pickup location is not available for the items in this cart.');
    }

    // Auto-resolve originLocationId if missing but needed (e.g., from online checkout)
    let finalOriginLocationId = originLocationId;
    if (!finalOriginLocationId && ['ship', 'pickup', 'dine_in'].includes(fulfillment)) {
      let locQuery = (isAdmin ? supabaseAdmin : supabase)
        .from("locations")
        .select("id")
        .eq("site_id", siteId)
        .eq("is_active", true)
        .limit(1);
      if (fulfillment === 'pickup' && pickupLocationRestriction && pickupLocationRestriction.length > 0) {
        locQuery = locQuery.in("id", pickupLocationRestriction);
      }
      const { data: locs } = await locQuery;
      if (locs && locs.length > 0) {
        finalOriginLocationId = locs[0].id;
      }
    }

    // 1. Resolve Lead (Create if shop and no leadId but has email)
    let finalLeadId = leadId;
    if (!finalLeadId && customerEmail && customerName) {
      const { data: existing } = await (isAdmin ? supabaseAdmin : supabase)
        .from("leads")
        .select("id, buyer_user_id")
        .eq("site_id", siteId)
        .eq("email", customerEmail)
        .single();
        
      if (existing) {
        finalLeadId = existing.id;
        // Update buyer_user_id on existing lead if we have it now and it was missing
        if (buyerUserId && !existing.buyer_user_id) {
          await supabaseAdmin.from('leads').update({ buyer_user_id: buyerUserId }).eq('id', existing.id);
        }
      } else {
        const { data: newLead } = await (isAdmin ? supabaseAdmin : supabase)
          .from("leads")
          .insert({ 
            site_id: siteId, 
            name: customerName, 
            email: customerEmail, 
            status: 'new', 
            user_id: resolvedUserId,
            buyer_user_id: buyerUserId || null
          })
          .select("id")
          .single();
        if (newLead) finalLeadId = newLead.id;
      }
    }

    // 2. Resolve default price list if lead has one
    let finalPriceListId = priceListId;
    if (!finalPriceListId && finalLeadId) {
      const { data: lead } = await (isAdmin ? supabaseAdmin : supabase).from("leads").select("default_price_list_id").eq("id", finalLeadId).single();
      if (lead?.default_price_list_id) {
        finalPriceListId = lead.default_price_list_id;
      }
    }

    // 3. Process Lines (Verify Stock & Resolve Prices)
    let orderSubtotal = 0;
    const processedLines = [];
    const catalogItemsForShipping: Partial<import("@/app/types").CatalogItem>[] = [];
    
    for (const line of lines) {
      // Assert can sell
      await assertCanSell(siteId, line.catalogItemId, line.quantity, originLocationId, isAdmin);

      const { data: catalogItem } = await (isAdmin ? supabaseAdmin : supabase)
        .from("catalog_items")
        .select("name, description, is_recurring, kind, digital_subtype, is_reservation, currency, metadata")
        .eq("id", line.catalogItemId)
        .single();
        
      const isAccessOnly = catalogItem?.is_recurring || (catalogItem?.kind === 'digital_asset' && catalogItem?.digital_subtype === 'pass');

      if (catalogItem?.is_reservation && !isAccessOnly) {
        if (!line.reservationStart || !line.reservationEnd) {
          throw new Error("Reservation dates are required for drop-in reservable items.");
        }
        if (!finalLeadId && !isAdmin) {
          throw new Error("Reservable items require a customer.");
        }
        await assertReservationSlot(
          siteId,
          line.catalogItemId,
          line.reservationStart,
          line.reservationEnd,
          line.quantity,
          isAdmin
        );
      }
      
      // Resolve price
      let price = line.unitPriceOverride;
      if (price === undefined) {
        const { price: resolvedPrice } = await resolveUnitPrice(siteId, line.catalogItemId, finalPriceListId, isAdmin);
        price = resolvedPrice || 0;
      }
      
      const subtotal = price * line.quantity;
      orderSubtotal += subtotal;
      
      if (catalogItem) {
        catalogItemsForShipping.push(catalogItem as any);
      }
      
      processedLines.push({
        site_id: siteId,
        catalog_item_id: line.catalogItemId,
        name: catalogItem?.name || "Unknown Item",
        description: catalogItem?.description,
        currency: catalogItem?.currency || "USD",
        quantity: line.quantity,
        unit_price: price,
        subtotal: subtotal,
        is_reservation_dropin: catalogItem?.is_reservation && !isAccessOnly,
        reservationStart: line.reservationStart,
        reservationEnd: line.reservationEnd
      });
    }

    const { data: taxesByItem } = await getTaxesByCatalogItemIds(
      siteId,
      processedLines.map((pl) => pl.catalog_item_id)
    );
    const orderTaxTotal = calculateOrderTaxTotal(
      processedLines.map((pl) => ({ catalogItemId: pl.catalog_item_id, subtotal: pl.subtotal })),
      taxesByItem || {}
    );

    // Calculate shipping cost
    let orderShippingCost = 0;
    if (fulfillment === 'ship') {
      const { resolveOrderShippingCost } = await import('./delivery-options');
      orderShippingCost = resolveOrderShippingCost(
        fulfillment,
        orderSubtotal,
        siteSettings?.shop?.free_shipping_threshold,
        siteSettings?.shop?.shipping_cost,
        catalogItemsForShipping
      );
    }

    let orderTotal = roundMoney(orderSubtotal + orderTaxTotal + orderShippingCost);

    // Verify all items have the same currency
    const uniqueCurrencies = Array.from(new Set(processedLines.map(pl => pl.currency)));
    if (uniqueCurrencies.length > 1) {
      throw new Error("All items in the cart must use the same currency.");
    }
    const orderCurrency = uniqueCurrencies[0] || 'USD';

    // Fail-fast: validate promotion before creating sale/order (avoids orphan orders)
    let normalizedPromotionCode: string | undefined;
    let promoDiscount = 0;
    if (promotionCode?.trim()) {
      normalizedPromotionCode = promotionCode.trim().toUpperCase();
      const promoPreview = await resolvePromotionDiscount({
        siteId,
        code: normalizedPromotionCode,
        lines: processedLines.map((pl) => ({
          catalogItemId: pl.catalog_item_id,
          subtotal: pl.subtotal,
        })),
        buyerUserId,
        leadId: finalLeadId,
        excludeOrderId: existingOrderId || null,
        forceServiceRole: isAdmin,
      });
      if ("error" in promoPreview) {
        throw new Error(`Promotion failed: ${promoPreview.error}`);
      }
      promoDiscount = promoPreview.data.discount;
      orderTotal = roundMoney(
        Math.max(0, orderSubtotal - promoDiscount + orderTaxTotal + orderShippingCost)
      );
    }

    // Calculate total paid if payments are provided
    const totalPaid = payments ? payments.reduce((sum, p) => sum + p.amount, 0) : 0;
    const isFullyPaid = (payments && totalPaid >= orderTotal) || orderTotal === 0;
    
    let saleInitialStatus = 'pending';
    let orderInitialStatus = 'pending';

    if (intent === 'complete') {
      saleInitialStatus = 'completed';
      orderInitialStatus = 'completed';
    } else if (intent === 'pay') {
      saleInitialStatus = isFullyPaid ? 'completed' : 'pending';
      orderInitialStatus = isFullyPaid ? 'completed' : 'pending';
    } else if (intent === 'send' || intent === 'draft') {
      // Default to pending. If updating, we'll refine this below.
      saleInitialStatus = 'pending';
      orderInitialStatus = 'pending';
    } else {
      // Backwards compatibility if intent is not passed
      saleInitialStatus = isFullyPaid ? 'completed' : 'pending';
      orderInitialStatus = saleInitialStatus;
    }

    const paymentMethodToStore = payments && payments.length > 0 
      ? (payments.length === 1 ? payments[0].method : 'multiple')
      : paymentMethod || undefined;

    let sale: any;
    let order: any;
    let existingItems: any[] = [];
    let hasNewOrChangedLines = false;

    if (existingOrderId) {
      const { data: existingOrder } = await (isAdmin ? supabaseAdmin : supabase).from("sale_orders").select("sale_id, status").eq("id", existingOrderId).single();
      if (!existingOrder) throw new Error("Existing order not found");
      
      const { data: existingSale } = await (isAdmin ? supabaseAdmin : supabase).from("sales").select("status, amount_due").eq("id", existingOrder.sale_id).single();

      // Load existing items for diffing
      const { data: items } = await (isAdmin ? supabaseAdmin : supabase).from("sale_order_items").select("*").eq("sale_order_id", existingOrderId);
      if (items) existingItems = items;

      // Diff lines to detect new/changed
      for (const pl of processedLines) {
        const existingItem = existingItems.find(ei => ei.catalog_item_id === pl.catalog_item_id);
        if (!existingItem) {
          hasNewOrChangedLines = true;
          break;
        } else if (pl.quantity > existingItem.quantity) {
          hasNewOrChangedLines = true;
          break;
        }
      }

      if (intent === 'send') {
        if (hasNewOrChangedLines) {
          orderInitialStatus = 'pending'; // Reopen order
          saleInitialStatus = (existingSale?.amount_due > 0 || !isFullyPaid) ? 'pending' : (existingSale?.status || 'completed');
        } else {
          // No new lines, keep existing statuses
          orderInitialStatus = existingOrder.status;
          saleInitialStatus = existingSale?.status || 'completed';
        }
      } else if (intent === 'draft') {
         orderInitialStatus = existingOrder.status;
         saleInitialStatus = existingSale?.status || 'pending';
      } else if (intent !== 'complete' && intent !== 'pay') {
         // Keep if no intent
         orderInitialStatus = existingOrder.status === 'completed' && !isFullyPaid ? 'completed' : orderInitialStatus;
         saleInitialStatus = existingSale?.status === 'completed' && !isFullyPaid ? 'completed' : saleInitialStatus;
      }

      // Update Sale
      const saleData: any = {
        site_id: siteId,
        lead_id: finalLeadId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        location_id: finalOriginLocationId || null,
        title: `Order - ${new Date().toLocaleDateString()}`,
        status: saleInitialStatus,
        amount: orderTotal,
        amount_due: payments ? Math.max(0, orderTotal - totalPaid) : orderTotal,
        currency: orderCurrency,
        user_id: resolvedUserId,
        sale_date: new Date().toISOString().split('T')[0],
        source: source,
      };

      if (paymentMethodToStore) {
         saleData.payment_method = paymentMethodToStore;
      }
      if (payments && payments.length > 0) {
        saleData.payments = payments.map(p => ({
          method: p.method,
          amount: p.amount,
          tendered: p.tendered || p.amount,
          change: p.change || 0,
          date: new Date().toISOString(),
          status: 'completed'
        }));
      }

      const { data: updatedSale, error: saleError } = await (isAdmin ? supabaseAdmin : supabase)
        .from("sales")
        .update(saleData)
        .eq("id", existingOrder.sale_id)
        .select()
        .single();
      if (saleError) throw new Error(`Sale error: ${saleError.message}`);
      sale = updatedSale;

      // Update Order
      const orderData: any = {
        price_list_id: finalPriceListId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        fulfillment_method: fulfillment,
        origin_location_id: finalOriginLocationId || null,
        shipping_address: shippingAddress || null,
        scheduled_for: scheduledFor || null,
        subtotal: orderSubtotal,
        tax_total: orderTaxTotal,
        shipping_cost: orderShippingCost,
        total: orderTotal,
        currency: orderCurrency,
        status: orderInitialStatus,
        user_id: resolvedUserId,
        items: processedLines.map(pl => ({
          id: pl.catalog_item_id,
          name: pl.name,
          quantity: pl.quantity,
          unitPrice: pl.unit_price,
          subtotal: pl.subtotal,
          metadata: { is_new: intent === 'send' } // For backwards compatibility
        }))
      };

      const { data: updatedOrder, error: orderError } = await (isAdmin ? supabaseAdmin : supabase)
        .from("sale_orders")
        .update(orderData)
        .eq("id", existingOrderId)
        .select()
        .single();
      if (orderError) throw new Error(`Order error: ${orderError.message}`);
      order = updatedOrder;

    } else {
      // 4. Create New Sale
      const saleData: any = {
        site_id: siteId,
        lead_id: finalLeadId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        location_id: finalOriginLocationId || null,
        title: `Order - ${new Date().toLocaleDateString()}`,
        status: saleInitialStatus,
        amount: orderTotal,
        amount_due: payments ? Math.max(0, orderTotal - totalPaid) : orderTotal,
        currency: orderCurrency,
        user_id: resolvedUserId,
        sale_date: new Date().toISOString().split('T')[0],
        source: source,
        payment_method: paymentMethodToStore,
        payments: payments ? payments.map(p => ({
          method: p.method,
          amount: p.amount,
          tendered: p.tendered || p.amount,
          change: p.change || 0,
          date: new Date().toISOString(),
          status: 'completed'
        })) : []
      };

      const { data: newSale, error: saleError } = await (isAdmin ? supabaseAdmin : supabase)
        .from("sales")
        .insert(saleData)
        .select()
        .single();

      if (saleError) throw new Error(`Sale error: ${saleError.message}`);
      sale = newSale;

      // 5. Create New Order
      const orderData: any = {
        site_id: siteId,
        sale_id: sale.id,
        price_list_id: finalPriceListId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        fulfillment_method: fulfillment,
        origin_location_id: finalOriginLocationId || null,
        shipping_address: shippingAddress || null,
        scheduled_for: scheduledFor || null,
        subtotal: orderSubtotal,
        tax_total: orderTaxTotal,
        shipping_cost: orderShippingCost,
        total: orderTotal,
        currency: orderCurrency,
        discount_total: promoDiscount,
        status: orderInitialStatus,
        order_number: `ORD-${Date.now().toString().slice(-6)}`,
        user_id: resolvedUserId,
        items: processedLines.map(pl => ({
          id: pl.catalog_item_id,
          name: pl.name,
          quantity: pl.quantity,
          unitPrice: pl.unit_price,
          subtotal: pl.subtotal,
          metadata: { is_new: intent === 'send' }
        }))
      };

      const { data: newOrder, error: orderError } = await (isAdmin ? supabaseAdmin : supabase)
        .from("sale_orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw new Error(`Order error: ${orderError.message}`);
      order = newOrder;
    }

    // 6. Manage Order Items (Diff and Upsert)
    const itemsToUpsert = [];
    const processedCatalogItemIds = new Set(processedLines.map(pl => pl.catalog_item_id));

    // Delete lines that were removed from the cart, BUT ONLY if they are still 'draft'
    if (existingOrderId && existingItems.length > 0) {
      for (const ei of existingItems) {
        if (!processedCatalogItemIds.has(ei.catalog_item_id)) {
          if (ei.status === 'draft') {
            await (isAdmin ? supabaseAdmin : supabase).from("sale_order_items").delete().eq("id", ei.id);
            await supabaseAdmin.from("reservations").delete().eq("sale_order_item_id", ei.id);
          } else {
            // Re-add to processedLines since it's completed/preparing and shouldn't be deleted from cart logic?
            // Actually, if it's removed from cart but was already sent/completed, maybe we just ignore and keep it in DB.
            // (We don't add it to itemsToUpsert, so it stays untouched in the DB).
          }
        }
      }
    }

    for (const pl of processedLines) {
      const existingItem = existingItems.find(ei => ei.catalog_item_id === pl.catalog_item_id);
      
      let newStatus = 'draft';
      let sentAt = null;

      if (intent === 'complete' || (intent === 'pay' && isFullyPaid)) {
        newStatus = 'completed';
      } else if (intent === 'send') {
        if (!existingItem || pl.quantity > existingItem.quantity) {
           newStatus = 'new';
           sentAt = new Date().toISOString();
        } else {
           // Unchanged, keep previous
           newStatus = existingItem.status === 'draft' ? 'new' : existingItem.status;
           sentAt = existingItem.sent_at || (newStatus === 'new' ? new Date().toISOString() : null);
        }
      } else {
        // intent is draft or undefined
        newStatus = existingItem ? existingItem.status : 'draft';
        sentAt = existingItem ? existingItem.sent_at : null;
      }

      itemsToUpsert.push({
        id: existingItem ? existingItem.id : undefined, // If id is undefined, Supabase insert/upsert will auto-generate it if omitted or error, wait, it's better to omit id if it's new.
        sale_order_id: order.id,
        site_id: siteId,
        catalog_item_id: pl.catalog_item_id,
        name: pl.name,
        description: pl.description,
        quantity: pl.quantity,
        unit_price: pl.unit_price,
        subtotal: pl.subtotal,
        status: newStatus,
        sent_at: sentAt,
        metadata: { is_new: newStatus === 'new' },
        _is_reservation_dropin: pl.is_reservation_dropin,
        _reservationStart: pl.reservationStart,
        _reservationEnd: pl.reservationEnd
      });
    }

    const upsertedItems = [];

    for (const item of itemsToUpsert) {
       let dbItem;
       const { _is_reservation_dropin, _reservationStart, _reservationEnd, ...dbPayload } = item;
       if (dbPayload.id) {
         const { data, error } = await (isAdmin ? supabaseAdmin : supabase)
           .from("sale_order_items")
           .update(dbPayload)
           .eq("id", dbPayload.id)
           .select()
           .single();
         if (error) throw new Error(`Sale order item update error: ${error.message}`);
         dbItem = data;
       } else {
         delete dbPayload.id; // Remove undefined id
         const { data, error } = await (isAdmin ? supabaseAdmin : supabase)
           .from("sale_order_items")
           .insert(dbPayload)
           .select()
           .single();
         if (error) throw new Error(`Sale order item insert error: ${error.message}`);
         dbItem = data;
       }
       upsertedItems.push({ ...dbItem, _is_reservation_dropin, _reservationStart, _reservationEnd });
    }

    // 6.a Handle reservations
    for (const item of upsertedItems) {
      if (item._is_reservation_dropin && item._reservationStart && item._reservationEnd) {
        // Check if reservation already exists for this order item
        const { data: existingRes } = await supabaseAdmin
          .from("reservations")
          .select("id")
          .eq("sale_order_item_id", item.id)
          .single();

        const resStatus = ['completed', 'pay'].includes(intent || '') && isFullyPaid ? 'confirmed' : 'pending';

        if (existingRes) {
           await supabaseAdmin.from("reservations").update({
             status: resStatus,
             quantity: item.quantity,
             start_time: item._reservationStart,
             end_time: item._reservationEnd
           }).eq("id", existingRes.id);
        } else {
           if (!finalLeadId && !isAdmin) {
             throw new Error("Reservations require a valid customer/lead.");
           }
           await supabaseAdmin.from("reservations").insert({
             site_id: siteId,
             catalog_item_id: item.catalog_item_id,
             sale_order_item_id: item.id,
             lead_id: finalLeadId,
             buyer_user_id: buyerUserId || null,
             owner_site_id: ownerSiteId || null,
             start_time: item._reservationStart,
             end_time: item._reservationEnd,
             quantity: item.quantity,
             status: resStatus
           });
        }
      }
    }

    // 6.b Update order JSONB items for backwards compatibility is already handled above in the update/insert.

    // 7. Apply Promotion (if provided) — already validated above; persist discount + usage
    if (normalizedPromotionCode) {
      const { data: orderWithPromo } = await (isAdmin ? supabaseAdmin : supabase).from("sale_orders").select("promotion_id").eq("id", order.id).single();
      
      if (!orderWithPromo?.promotion_id) {
        const promoResult = await applyPromotionToOrder(siteId, order.id, normalizedPromotionCode, isAdmin);
        if (promoResult.error) {
          throw new Error(`Promotion failed: ${promoResult.error}`);
        }
      }
    }

    // 8. Create Shipment (if ship)
    if (fulfillment === 'ship' && finalOriginLocationId && resolvedUserId && orderInitialStatus === 'completed') {
      const shipResult = await createShipment({
        siteId,
        saleOrderId: order.id,
        saleId: sale.id,
        leadId: finalLeadId,
        originLocationId: finalOriginLocationId,
        shippingAddress,
        userId: resolvedUserId,
        forceServiceRole: isAdmin
      });
      if (shipResult.error) throw new Error(`Shipment error: ${shipResult.error}`);
    } else if (finalOriginLocationId && orderInitialStatus === 'completed') {
      // Non-ship fulfillments (pickup, dine_in, none) are marked completed immediately if paid.
      // Therefore, if policy is NOT 'never', we should decrement stock now since the order is finalized.
      const { data: settings } = await (isAdmin ? supabaseAdmin : supabase).from("settings").select("commerce").eq("site_id", siteId).single();
      const policy = settings?.commerce?.decrement_stock_on || 'ship';
      
      if (policy !== 'never') {
        for (const line of lines) {
          const { data: catItem } = await (isAdmin ? supabaseAdmin : supabase).from("catalog_items").select("track_inventory").eq("id", line.catalogItemId).single();
          if (catItem?.track_inventory) {
            const { data: level } = await (isAdmin ? supabaseAdmin : supabase).from("inventory_levels")
              .select("id, quantity")
              .eq("catalog_item_id", line.catalogItemId)
              .eq("location_id", finalOriginLocationId)
              .single();
            if (level) {
              const newQty = Math.max(0, level.quantity - line.quantity);
              await (isAdmin ? supabaseAdmin : supabase).from("inventory_levels").update({ quantity: newQty }).eq("id", level.id);
            } else {
              await (isAdmin ? supabaseAdmin : supabase).from("inventory_levels").insert({
                site_id: siteId,
                location_id: finalOriginLocationId,
                catalog_item_id: line.catalogItemId,
                quantity: Math.max(0, -line.quantity) // floor at 0
              });
            }
          }
        }
      }
    }

    // 9. Subscriptions and Entitlements
    if (orderInitialStatus === 'completed') {
      try {
        await grantFromOrder(order.id, isAdmin);
      } catch (e) {
        console.error("Failed to grant entitlements:", e);
      }
    }

    // Check for recurring items
    const { data: catItems } = await (isAdmin ? supabaseAdmin : supabase)
      .from("catalog_items")
      .select("id, is_recurring")
      .in("id", processedLines.map(l => l.catalog_item_id));

    const recurringIds = catItems?.filter((c: any) => c.is_recurring).map((c: any) => c.id) || [];
    
    for (const line of processedLines) {
      if (recurringIds.includes(line.catalog_item_id)) {
        const { data: sub } = await (isAdmin ? supabaseAdmin : supabase)
          .from("subscriptions")
          .insert({
            site_id: siteId,
            lead_id: finalLeadId,
            buyer_user_id: buyerUserId || null,
            owner_site_id: ownerSiteId || null,
            catalog_item_id: line.catalog_item_id,
            amount: line.unit_price,
            status: orderInitialStatus === 'completed' ? 'active' : 'pending'
          })
          .select("id")
          .single();

        if (sub && orderInitialStatus === 'completed') {
          await syncSubscriptionEntitlements(sub.id, isAdmin);
        }
      }
    }

    return { success: true, saleId: sale.id, orderId: order.id };
  } catch (error: any) {
    return { error: error.message };
  }
}
