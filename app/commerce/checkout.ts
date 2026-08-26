"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanSell } from "@/app/catalog/sell-availability";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { resolveUnitPrice } from "@/app/price-lists/actions";
import { toPriceListChannel } from "@/app/price-lists/price-list-channels";
import { applyPromotionToOrder } from "@/app/promotions/apply-promotion-to-order";
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion";
import { createShipment } from "@/app/shipments/actions";
import { isAccessOnlyItem, shouldSkipVariantSelectionForCheckoutLine } from "@/app/catalog/product-details";
import {
  assertCommerceReservationSlot,
} from "@/app/commerce/pass-round-robin-server";
import { isRoundRobinPass } from "@/app/commerce/pass-round-robin";
import { grantFromOrder, syncSubscriptionEntitlements } from "./entitlements";
import { calculateOrderTaxTotal, roundMoney } from "./taxes";
import { getUsdFxRates } from "@/app/lib/fx-rates";
import {
  checkoutLinesNeedFxConversion,
  normalizeCheckoutLinesToCurrency,
  resolveCheckoutOrderCurrency,
  resolveProductCurrency,
} from "./checkout-currency";
import {
  findPosClientMutation,
  recordPosClientMutation,
} from "@/app/pos/actions/idempotency";
import {
  assertQuotationCheckoutable,
  markQuotationAccepted,
  quotationItemsToCheckoutLines,
  type QuotationForCheckout,
} from "@/app/quotations/quote-checkout";
import {
  generatePublicAccessToken,
  isValidPublicAccessToken,
} from "@/app/documents/public-token";
import { upsertSaleOrderItemsWithModifiers } from "./checkout-order-items"
import {
  isStaffReservationCheckout,
  syncCheckoutDropinReservations,
} from "./checkout-reservations"
import { kitchenDeltaForSend } from "./checkout-print-delta";
import {
  commerceLeadCreateFields,
  ensureCommerceLeadConverted,
  isCommerceLeadSource,
} from "./ensure-commerce-lead-converted";
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure";
import { format } from "date-fns";

export interface CheckoutLineModifier {
  catalogItemId: string;
  /** Quantity per host unit (multiplied by host quantity when writing order lines). */
  quantity: number;
  unitPriceOverride?: number;
  groupId?: string;
}

export interface CheckoutLine {
  catalogItemId: string;
  quantity: number;
  unitPriceOverride?: number; // Used for quotes to honor the quoted price
  reservationStart?: string; // ISO
  reservationEnd?: string;   // ISO
  /** Stable cart line id for matching on order updates (POS modifiers). */
  clientLineKey?: string;
  modifiers?: CheckoutLineModifier[];
}

export interface CheckoutCartParams {
  siteId: string;
  lines: CheckoutLine[];
  priceListId?: string;
  leadId?: string;
  promotionCode?: string;
  /** Automatic / condition-based promotion without a coupon code. */
  promotionId?: string;
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
  /** Client-generated id for local-first POS outbox idempotency */
  clientMutationId?: string;
  /** When set, lines/prices come from the quotation (server-authoritative). */
  quotationId?: string;
  /** Public share token from /q/[token] — allows guest checkout for that quote. */
  publicAccessToken?: string;
  /** Customer special instructions for the order (sale_orders.notes). */
  notes?: string;
  /** Attach the sale line to this reservation instead of inserting another row. */
  existingReservationId?: string;
  isStaffMutation?: boolean;
}

export async function checkoutCart({
  siteId,
  lines: inputLines,
  priceListId: inputPriceListId,
  leadId: inputLeadId,
  promotionCode,
  promotionId: inputPromotionId,
  fulfillment,
  originLocationId,
  shippingAddress,
  source: inputSource,
  userId,
  buyerUserId: inputBuyerUserId,
  ownerSiteId,
  customerName,
  customerEmail,
  payments,
  existingOrderId,
  intent,
  paymentMethod,
  scheduledFor,
  clientMutationId,
  quotationId,
  publicAccessToken,
  notes,
  existingReservationId,
  isStaffMutation,
}: CheckoutCartParams) {
  try {
    if (clientMutationId && inputSource === "pos") {
      const existing = await findPosClientMutation(siteId, clientMutationId);
      if (existing.data) {
        return {
          success: true,
          saleId: existing.data.sale_id || undefined,
          orderId: existing.data.order_id || undefined,
          idempotent: true,
        };
      }
    }

    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient(true);

    let lines = inputLines;
    let source = inputSource;
    let priceListId = inputPriceListId;
    let leadId = inputLeadId;
    let buyerUserId = inputBuyerUserId;
    let quoteForAccept: QuotationForCheckout | null = null;

    if (quotationId) {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUserId = session?.user?.id || inputBuyerUserId || null;

      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("quotations")
        .select("*, items:quotation_items(*)")
        .eq("id", quotationId)
        .single();

      if (quoteError || !quote) throw new Error("Quotation not found");

      const tokenOk =
        Boolean(publicAccessToken) &&
        typeof quote.public_access_token === "string" &&
        quote.public_access_token === publicAccessToken;

      const gate = assertQuotationCheckoutable(quote, {
        buyerUserId: sessionUserId,
        siteId,
        publicAccess: tokenOk,
      });
      if (!gate.ok) throw new Error(gate.error);

      quoteForAccept = quote as QuotationForCheckout;
      lines = quotationItemsToCheckoutLines(quote.items || []);
      source = "quote";
      priceListId = priceListId || quote.price_list_id || undefined;
      leadId = leadId || quote.lead_id || undefined;
      buyerUserId = sessionUserId || quote.buyer_user_id || inputBuyerUserId;
    }
    
    const isAdmin = ['shop', 'marketplace', 'quote'].includes(source);
    const isStaffCheckout = isStaffReservationCheckout({
      source: inputSource,
      isStaffMutation,
    });
    
    // For shop, userId is undefined, so we need to get the site's user_id
    let resolvedUserId = userId;
    // Shop/storefront settings live on the `settings` table (not sites.settings).
    // Must match getShopSite / SiteContext so delivery defaults stay in sync with the cart UI.
    const { data: settingsRow } = await supabaseAdmin
      .from("settings")
      .select("*")
      .eq("site_id", siteId)
      .maybeSingle();
    const siteSettings: any = settingsRow || {};

    if (isAdmin) {
      const { data: site } = await supabaseAdmin.from("sites").select("user_id").eq("id", siteId).single();
      if (site) {
        resolvedUserId = resolvedUserId || site.user_id;
      }
    }

    // Location & timing validation
    let resolvedScheduledFor = scheduledFor;
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

      // 2. Store hours gate shop/marketplace ASAP; POS can sell while closed
      const { resolveCheckoutScheduledFor } = await import('./checkout-schedule');
      resolvedScheduledFor = resolveCheckoutScheduledFor({
        source,
        scheduledFor: resolvedScheduledFor,
        businessHours: siteSettings.business_hours || [],
      });
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
    if (hasDigitalOrRecurring && !buyerUserId) {
      if (source === 'pos') {
        throw new Error("Digital items require a buyer account.");
      }
      if (source === 'shop' || source === 'marketplace' || source === 'quote') {
        throw new Error("You must be logged in to purchase digital assets or subscriptions.");
      }
    }

    // Validate fulfillment against allowed options (same defaults as shop UI).
    // POS cart always offers dine_in / none; keep checkout in sync so outbox drain succeeds.
    const {
      getItemDeliveryOptions,
      isFulfillmentAllowed,
      intersectPickupLocationIds,
      POS_ALWAYS_ALLOWED_FULFILLMENTS,
    } = await import('./delivery-options');
    const siteDefaultDelivery = siteSettings?.shop?.default_delivery_options;
    const itemsWithOptions = catItemsForCheck.map((item: any) => ({
      allowed: getItemDeliveryOptions(item, siteDefaultDelivery),
    }));
    if (!isFulfillmentAllowed(
      fulfillment as any,
      itemsWithOptions,
      source === 'pos' ? POS_ALWAYS_ALLOWED_FULFILLMENTS : [],
    )) {
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
        const createFields = isCommerceLeadSource(source)
          ? commerceLeadCreateFields(source, false)
          : { status: "new" as const };
        const { data: newLead } = await (isAdmin ? supabaseAdmin : supabase)
          .from("leads")
          .insert({ 
            site_id: siteId, 
            name: customerName, 
            email: customerEmail, 
            user_id: resolvedUserId,
            buyer_user_id: buyerUserId || null,
            ...createFields,
          })
          .select("id")
          .single();
        if (newLead) finalLeadId = newLead.id;
      }
    }

    // Storefront sources only honor lists whose channels include that source.
    const priceListChannel = toPriceListChannel(source);

    // 2. Resolve default price list and dims if lead has one
    let finalPriceListId = priceListId;
    let leadCampaignId = null;
    let leadSegmentId = null;
    let leadCompanyId = null;

    if (finalLeadId) {
      const { data: lead } = await (isAdmin ? supabaseAdmin : supabase)
        .from("leads")
        .select("default_price_list_id, campaign_id, segment_id, company_id")
        .eq("id", finalLeadId)
        .single();
      
      if (lead) {
        // Lead default list is for POS/sales; shop/marketplace resolve via site default + channels.
        if (
          !finalPriceListId &&
          lead.default_price_list_id &&
          (priceListChannel === null || priceListChannel === "pos")
        ) {
          finalPriceListId = lead.default_price_list_id;
        }
        leadCampaignId = lead.campaign_id;
        leadSegmentId = lead.segment_id;
        leadCompanyId = lead.company_id;
      }
    }

    // 3. Process Lines (Verify Stock & Resolve Prices)
    let orderSubtotal = 0;
    const processedLines: any[] = [];
    const catalogItemsForShipping: Partial<import("@/app/types").CatalogItem>[] = [];

    const resolveLinePrice = async (
      catalogItemId: string,
      unitPriceOverride: number | undefined,
    ) => {
      if (unitPriceOverride !== undefined) return unitPriceOverride;
      const { price: resolvedPrice } = await resolveUnitPrice(
        siteId,
        catalogItemId,
        finalPriceListId,
        isAdmin,
        priceListChannel,
      );
      return resolvedPrice || 0;
    };
    
    for (const line of lines) {
      // Assert can sell
      await assertCanSell(siteId, line.catalogItemId, line.quantity, originLocationId, isAdmin, {
        skipVariantSelection: shouldSkipVariantSelectionForCheckoutLine({
          existingReservationId,
          reservationStart: line.reservationStart,
        }),
      });

      const { data: catalogItem } = await (isAdmin ? supabaseAdmin : supabase)
        .from("catalog_items")
        .select("id, name, description, is_recurring, kind, digital_subtype, is_reservation, redeem_assignment_mode, currency, metadata, target_sale_price, parent_id, parent:parent_id(name)")
        .eq("id", line.catalogItemId)
        .single();
        
      const isAccessOnly = isAccessOnlyItem({
        is_recurring: Boolean(catalogItem?.is_recurring),
        kind: catalogItem?.kind,
        digital_subtype: catalogItem?.digital_subtype,
        redeem_assignment_mode: catalogItem?.redeem_assignment_mode,
      } as any);

      let isRoundRobinDropin = false;
      let effectiveAssignmentMode = catalogItem?.redeem_assignment_mode;
      
      if (catalogItem?.is_reservation && !isAccessOnly) {
        const hasReservationDates = Boolean(line.reservationStart && line.reservationEnd);
        const canReuseLinkedReservation = Boolean(existingReservationId || existingOrderId);
        if (!hasReservationDates && !canReuseLinkedReservation) {
          throw new Error("Reservation dates are required for drop-in reservable items.");
        }
        if (!finalLeadId && !isAdmin) {
          throw new Error("Reservable items require a customer.");
        }
        
        isRoundRobinDropin = isRoundRobinPass(catalogItem);
        
        // If it's a variant, check the parent's mode
        if (!isRoundRobinDropin && catalogItem?.parent_id) {
          const { data: parentItem } = await (isAdmin ? supabaseAdmin : supabase)
            .from("catalog_items")
            .select("redeem_assignment_mode")
            .eq("id", catalogItem.parent_id)
            .single();
            
          if (parentItem?.redeem_assignment_mode === "round_robin") {
            isRoundRobinDropin = true;
            effectiveAssignmentMode = "round_robin";
          }
        }
        
        if (hasReservationDates) {
          await assertCommerceReservationSlot({
            siteId,
            catalogItem: {
              id: catalogItem.id,
              kind: catalogItem.kind,
              digital_subtype: catalogItem.digital_subtype,
              redeem_assignment_mode: effectiveAssignmentMode,
            },
            startIso: line.reservationStart!,
            endIso: line.reservationEnd!,
            quantity: line.quantity,
            isAdmin: isStaffCheckout,
            ignoreReservationId: existingReservationId,
          });
        }
      }
      
      const price = await resolveLinePrice(line.catalogItemId, line.unitPriceOverride);
      const subtotal = price * line.quantity;
      orderSubtotal += subtotal;
      
      if (catalogItem) {
        catalogItemsForShipping.push(catalogItem as any);
      }

      let finalName = catalogItem?.name || "Unknown Item";
      let parentName = null;
      if ((catalogItem as any)?.parent?.name && (catalogItem as any).parent.name !== catalogItem?.name) {
        parentName = (catalogItem as any).parent.name;
        // finalName remains the variant name, we store parent name in metadata
      }

      const clientLineKey =
        line.clientLineKey ||
        `${line.catalogItemId}:${processedLines.length}`;
      
      processedLines.push({
        site_id: siteId,
        catalog_item_id: line.catalogItemId,
        name: finalName,
        description: catalogItem?.description,
        currency: resolveProductCurrency(catalogItem?.currency, siteSettings?.currency),
        quantity: line.quantity,
        unit_price: price,
        subtotal: subtotal,
        is_reservation_dropin: catalogItem?.is_reservation && !isAccessOnly,
        reservationStart: line.reservationStart,
        reservationEnd: line.reservationEnd,
        isRoundRobinDropin,
        client_line_key: clientLineKey,
        parent_client_line_key: null as string | null,
        modifier_group_id: null as string | null,
        parent_name: parentName,
      });

      for (const mod of line.modifiers || []) {
        if (!mod.catalogItemId || !(mod.quantity > 0)) continue;
        const modQty = mod.quantity * line.quantity;
        await assertCanSell(
          siteId,
          mod.catalogItemId,
          modQty,
          originLocationId,
          isAdmin,
        );
        const { data: modItem } = await (isAdmin ? supabaseAdmin : supabase)
          .from("catalog_items")
          .select("name, description, currency")
          .eq("id", mod.catalogItemId)
          .single();
        const modPrice = await resolveLinePrice(
          mod.catalogItemId,
          mod.unitPriceOverride,
        );
        const modSubtotal = modPrice * modQty;
        orderSubtotal += modSubtotal;
        processedLines.push({
          site_id: siteId,
          catalog_item_id: mod.catalogItemId,
          name: modItem?.name || "Extra",
          description: modItem?.description,
          currency: resolveProductCurrency(
            modItem?.currency || catalogItem?.currency,
            siteSettings?.currency,
          ),
          quantity: modQty,
          unit_price: modPrice,
          subtotal: modSubtotal,
          is_reservation_dropin: false,
          reservationStart: undefined,
          reservationEnd: undefined,
          isRoundRobinDropin: false,
          client_line_key: `${clientLineKey}:mod:${mod.groupId || "g"}:${mod.catalogItemId}`,
          parent_client_line_key: clientLineKey,
          modifier_group_id: mod.groupId || null,
          parent_name: null,
        });
      }
    }

    const orderCurrency = resolveCheckoutOrderCurrency(
      processedLines,
      siteSettings?.currency,
    );
    if (checkoutLinesNeedFxConversion(processedLines, orderCurrency)) {
      const { rates } = await getUsdFxRates();
      const normalized = normalizeCheckoutLinesToCurrency(
        processedLines,
        orderCurrency,
        rates,
      );
      processedLines.length = 0;
      processedLines.push(...normalized.lines);
      orderSubtotal = normalized.subtotal;
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

    // Fail-fast: validate promotion before creating sale/order (avoids orphan orders)
    let normalizedPromotionCode: string | undefined;
    let resolvedPromotionId: string | undefined;
    let promoDiscount = 0;
    if (promotionCode?.trim() || inputPromotionId) {
      normalizedPromotionCode = promotionCode?.trim()
        ? promotionCode.trim().toUpperCase()
        : undefined;
      resolvedPromotionId = inputPromotionId || undefined;
      const promoPreview = await resolvePromotionDiscount({
        siteId,
        code: normalizedPromotionCode,
        promotionId: resolvedPromotionId,
        lines: processedLines.map((pl) => ({
          catalogItemId: pl.catalog_item_id,
          subtotal: pl.subtotal,
          quantity: pl.quantity,
        })),
        buyerUserId,
        leadId: finalLeadId,
        source,
        locationId: originLocationId || null,
        excludeOrderId: existingOrderId || null,
        forceServiceRole: isAdmin,
      });
      if ("error" in promoPreview) {
        throw new Error(`Promotion failed: ${promoPreview.error}`);
      }
      promoDiscount = promoPreview.data.discount;
      resolvedPromotionId = promoPreview.data.promotionId;
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
      saleInitialStatus = isFullyPaid ? 'completed' : 'pending';
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

      // Diff lines to detect new/changed (prefer client_line_key for modifier carts)
      for (const pl of processedLines) {
        const existingItem = existingItems.find((ei: any) => {
          if (pl.client_line_key && ei.metadata?.client_line_key === pl.client_line_key) {
            return true;
          }
          if (
            !pl.parent_client_line_key &&
            !ei.parent_sale_order_item_id &&
            !ei.metadata?.client_line_key &&
            ei.catalog_item_id === pl.catalog_item_id
          ) {
            return true;
          }
          return false;
        });
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

      const firstItemName = processedLines.length > 0 ? processedLines[0].name : undefined;

      // Update Sale
      const saleData: any = {
        site_id: siteId,
        lead_id: finalLeadId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        location_id: finalOriginLocationId || null,
        campaign_id: leadCampaignId,
        segment_id: leadSegmentId,
        company_id: leadCompanyId,
        title: `Order - ${new Date().toLocaleDateString()}`,
        product_name: firstItemName,
        status: saleInitialStatus,
        amount: orderTotal,
        amount_due: payments ? Math.max(0, orderTotal - totalPaid) : orderTotal,
        currency: orderCurrency,
        user_id: resolvedUserId,
        sale_date: format(new Date(), "yyyy-MM-dd"),
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
        scheduled_for: resolvedScheduledFor || null,
        subtotal: orderSubtotal,
        tax_total: orderTaxTotal,
        shipping_cost: orderShippingCost,
        total: orderTotal,
        currency: orderCurrency,
        ...(resolvedPromotionId || normalizedPromotionCode
          ? {
              discount_total: promoDiscount,
              ...(resolvedPromotionId ? { promotion_id: resolvedPromotionId } : {}),
            }
          : {}),
        status: orderInitialStatus,
        user_id: resolvedUserId,
        items: processedLines.map(pl => ({
          id: pl.catalog_item_id,
          name: pl.name,
          quantity: pl.quantity,
          unitPrice: pl.unit_price,
          subtotal: pl.subtotal,
          metadata: {
            is_new: intent === 'send',
            client_line_key: pl.client_line_key,
            parent_client_line_key: pl.parent_client_line_key,
            is_modifier: !!pl.parent_client_line_key,
            modifier_group_id: pl.modifier_group_id,
            parent_name: pl.parent_name,
          }
        })),
        ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
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
      const firstItemName = processedLines.length > 0 ? processedLines[0].name : undefined;

      // 4. Create New Sale
      const saleData: any = {
        site_id: siteId,
        lead_id: finalLeadId,
        buyer_user_id: buyerUserId || null,
        owner_site_id: ownerSiteId || null,
        location_id: finalOriginLocationId || null,
        campaign_id: leadCampaignId,
        segment_id: leadSegmentId,
        company_id: leadCompanyId,
        accounting_state: 'pending',
        title: `Order - ${new Date().toLocaleDateString()}`,
        product_name: firstItemName,
        status: saleInitialStatus,
        amount: orderTotal,
        amount_due: payments ? Math.max(0, orderTotal - totalPaid) : orderTotal,
        currency: orderCurrency,
        user_id: resolvedUserId,
        sale_date: format(new Date(), "yyyy-MM-dd"),
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
        scheduled_for: resolvedScheduledFor || null,
        subtotal: orderSubtotal,
        tax_total: orderTaxTotal,
        shipping_cost: orderShippingCost,
        total: orderTotal,
        currency: orderCurrency,
        discount_total: promoDiscount,
        ...(resolvedPromotionId ? { promotion_id: resolvedPromotionId } : {}),
        status: orderInitialStatus,
        order_number: `ORD-${Date.now().toString().slice(-6)}`,
        user_id: resolvedUserId,
        notes: notes?.trim() || null,
        items: processedLines.map(pl => ({
          id: pl.catalog_item_id,
          name: pl.name,
          quantity: pl.quantity,
          unitPrice: pl.unit_price,
          subtotal: pl.subtotal,
          metadata: {
            is_new: intent === 'send',
            client_line_key: pl.client_line_key,
            parent_client_line_key: pl.parent_client_line_key,
            is_modifier: !!pl.parent_client_line_key,
            modifier_group_id: pl.modifier_group_id,
            parent_name: pl.parent_name,
          }
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

    // 6. Manage Order Items (Diff and Upsert) — supports nested modifier lines
    const upsertedItems = await upsertSaleOrderItemsWithModifiers({
      supabase,
      supabaseAdmin,
      isAdmin,
      siteId,
      orderId: order.id,
      existingOrderId,
      existingItems,
      processedLines,
      lines,
      intent,
      isFullyPaid,
    });

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId,
      upsertedItems,
      intent,
      isFullyPaid,
      isAdmin: isStaffCheckout,
      finalLeadId,
      buyerUserId,
      ownerSiteId,
      existingReservationId,
    });

    // 6.b Update order JSONB items for backwards compatibility is already handled above in the update/insert.

    // 7. Apply Promotion (if provided) — persist discount, promotion_id, and usage
    if (normalizedPromotionCode || resolvedPromotionId) {
      const promoResult = await applyPromotionToOrder(
        siteId,
        order.id,
        normalizedPromotionCode,
        isAdmin,
        resolvedPromotionId,
      );
      if (promoResult.error) {
        throw new Error(`Promotion failed: ${promoResult.error}`);
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

    const kitchenDelta = kitchenDeltaForSend({
      intent,
      existingItems,
      nextItems: upsertedItems,
    });

    if (clientMutationId && source === "pos") {
      await recordPosClientMutation({
        siteId,
        clientMutationId,
        kind: "checkout",
        saleId: sale.id,
        orderId: order.id,
        result: { success: true, kitchenDelta, intent: intent || null },
      });
    }

    if (quoteForAccept) {
      await markQuotationAccepted(supabaseAdmin, quoteForAccept, sale.id);
    }

    // Public share token so shop/marketplace buyers can open /so/[token] after checkout
    // (named distinctly from the quotation `publicAccessToken` param above)
    let orderPublicAccessToken =
      typeof order.public_access_token === "string" ? order.public_access_token : null;
    if (!isValidPublicAccessToken(orderPublicAccessToken)) {
      orderPublicAccessToken = generatePublicAccessToken();
      const { data: withToken, error: tokenError } = await (isAdmin
        ? supabaseAdmin
        : supabase)
        .from("sale_orders")
        .update({ public_access_token: orderPublicAccessToken })
        .eq("id", order.id)
        .select(
          "public_access_token, order_number, status, total, currency, created_at"
        )
        .single();
      if (tokenError || !withToken?.public_access_token) {
        throw new Error(
          `Failed to create public order link: ${tokenError?.message || "unknown"}`
        );
      }
      order = { ...order, ...withToken };
      orderPublicAccessToken = withToken.public_access_token as string;
    } else {
      const { data: latest } = await (isAdmin ? supabaseAdmin : supabase)
        .from("sale_orders")
        .select(
          "public_access_token, order_number, status, total, currency, created_at"
        )
        .eq("id", order.id)
        .single();
      if (latest) order = { ...order, ...latest };
      orderPublicAccessToken = order.public_access_token as string;
    }

    await tryUpsertPolizaForSale(sale.id, siteId);

    if (finalLeadId && resolvedUserId && isCommerceLeadSource(source)) {
      try {
        await ensureCommerceLeadConverted({
          supabase: isAdmin ? supabaseAdmin : supabase,
          siteId,
          leadId: finalLeadId,
          source,
          userId: resolvedUserId,
          amount: orderTotal,
          leadName: customerName,
          paid: orderInitialStatus === "completed",
        });
      } catch (e) {
        console.error("Failed to sync commerce lead conversion:", e);
      }
    }

    return {
      success: true,
      saleId: sale.id,
      orderId: order.id,
      publicAccessToken: orderPublicAccessToken,
      orderNumber: order.order_number ?? null,
      status: order.status ?? null,
      total: order.total ?? null,
      currency: order.currency ?? null,
      createdAt: order.created_at ?? null,
      kitchenDelta,
      notes: order.notes ?? notes ?? null,
      fulfillment: order.fulfillment_method ?? fulfillment ?? null,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}
