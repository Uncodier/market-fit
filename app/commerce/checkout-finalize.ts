import { createShipment } from "@/app/shipments/actions"
import { applyPromotionToOrder } from "@/app/promotions/apply-promotion-to-order"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import {
  completeQuotationCheckout,
  QuotationForCheckout,
} from "@/app/quotations/quote-checkout"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"
import { grantFromOrder, syncSubscriptionEntitlements } from "./entitlements"
import { upsertSaleOrderItemsWithModifiers } from "./checkout-order-items"
import { syncCheckoutDropinReservations } from "./checkout-reservations"
import { kitchenDeltaForSend } from "./checkout-print-delta"
import { recordPosClientMutation } from "@/app/pos/actions/idempotency"
import {
  ensureCommerceLeadConverted,
  isCommerceLeadSource,
} from "./ensure-commerce-lead-converted"
import {
  CheckoutCartParams,
  CheckoutLine,
  CheckoutSource,
  CheckoutSupabaseClient,
  ProcessedCheckoutLine,
} from "./checkout-types"

type FinalizeCheckoutParams = {
  supabase: CheckoutSupabaseClient
  supabaseAdmin: CheckoutSupabaseClient
  isAdmin: boolean
  isStaffCheckout: boolean
  siteId: string
  source: CheckoutSource
  lines: CheckoutLine[]
  processedLines: ProcessedCheckoutLine[]
  sale: any
  order: any
  existingItems: any[]
  effectiveExistingOrderId?: string
  intent?: CheckoutCartParams["intent"]
  isFullyPaid: boolean
  orderInitialStatus: string
  normalizedPromotionCode?: string
  resolvedPromotionId?: string
  fulfillment: CheckoutCartParams["fulfillment"]
  finalOriginLocationId?: string
  resolvedUserId?: string
  finalLeadId?: string
  buyerUserId?: string | null
  ownerSiteId?: string | null
  existingReservationId?: string
  shippingAddress?: any
  clientMutationId?: string
  quoteForAccept: QuotationForCheckout | null
  activeQuotationClaim: { quotationId: string; claimId: string } | null
  customerName?: string
  orderTotal: number
  notes?: string
}

export async function finalizeCheckout(params: FinalizeCheckoutParams) {
  const queryClient = params.isAdmin ? params.supabaseAdmin : params.supabase
  const upsertedItems = await upsertSaleOrderItemsWithModifiers({
    supabase: params.supabase,
    supabaseAdmin: params.supabaseAdmin,
    isAdmin: params.isAdmin,
    siteId: params.siteId,
    orderId: params.order.id,
    existingOrderId: params.effectiveExistingOrderId,
    existingItems: params.existingItems,
    processedLines: params.processedLines,
    lines: params.lines,
    intent: params.intent,
    isFullyPaid: params.isFullyPaid,
  })

  await syncCheckoutDropinReservations({
    supabaseAdmin: params.supabaseAdmin,
    siteId: params.siteId,
    upsertedItems,
    intent: params.intent,
    isFullyPaid: params.isFullyPaid,
    isAdmin: params.isStaffCheckout,
    finalLeadId: params.finalLeadId,
    buyerUserId: params.buyerUserId,
    ownerSiteId: params.ownerSiteId,
    existingReservationId: params.existingReservationId,
  })

  if (params.normalizedPromotionCode || params.resolvedPromotionId) {
    const result = await applyPromotionToOrder(
      params.siteId,
      params.order.id,
      params.normalizedPromotionCode,
      params.isAdmin,
      params.resolvedPromotionId
    )
    if (result.error) throw new Error(`Promotion failed: ${result.error}`)
  }

  if (
    params.fulfillment === "ship" &&
    params.finalOriginLocationId &&
    params.resolvedUserId &&
    params.orderInitialStatus === "completed"
  ) {
    const result = await createShipment({
      siteId: params.siteId,
      saleOrderId: params.order.id,
      saleId: params.sale.id,
      leadId: params.finalLeadId,
      originLocationId: params.finalOriginLocationId,
      shippingAddress: params.shippingAddress,
      userId: params.resolvedUserId,
      forceServiceRole: params.isAdmin,
    })
    if (result.error) throw new Error(`Shipment error: ${result.error}`)
  } else if (
    params.finalOriginLocationId &&
    params.orderInitialStatus === "completed"
  ) {
    const { data: settings } = await queryClient
      .from("settings")
      .select("commerce")
      .eq("site_id", params.siteId)
      .single()
    const policy = settings?.commerce?.decrement_stock_on || "ship"
    if (policy !== "never") {
      for (const line of params.lines) {
        const { data: catalogItem } = await queryClient
          .from("catalog_items")
          .select("track_inventory")
          .eq("id", line.catalogItemId)
          .single()
        if (!catalogItem?.track_inventory) continue
        const { data: level } = await queryClient
          .from("inventory_levels")
          .select("id, quantity")
          .eq("catalog_item_id", line.catalogItemId)
          .eq("location_id", params.finalOriginLocationId)
          .single()
        if (level) {
          await queryClient
            .from("inventory_levels")
            .update({
              quantity: Math.max(0, level.quantity - line.quantity),
            })
            .eq("id", level.id)
        } else {
          await queryClient.from("inventory_levels").insert({
            site_id: params.siteId,
            location_id: params.finalOriginLocationId,
            catalog_item_id: line.catalogItemId,
            quantity: Math.max(0, -line.quantity),
          })
        }
      }
    }
  }

  if (params.orderInitialStatus === "completed") {
    try {
      await grantFromOrder(params.order.id, params.isAdmin)
    } catch (error) {
      console.error("Failed to grant entitlements:", error)
    }
  }

  const { data: catalogItems } = await queryClient
    .from("catalog_items")
    .select("id, is_recurring")
    .in(
      "id",
      params.processedLines.map((line) => line.catalog_item_id)
    )
  const recurringIds =
    catalogItems
      ?.filter((item: any) => item.is_recurring)
      .map((item: any) => item.id) || []
  for (const line of params.processedLines) {
    if (!recurringIds.includes(line.catalog_item_id)) continue
    const { data: subscription } = await queryClient
      .from("subscriptions")
      .insert({
        site_id: params.siteId,
        lead_id: params.finalLeadId,
        buyer_user_id: params.buyerUserId || null,
        owner_site_id: params.ownerSiteId || null,
        catalog_item_id: line.catalog_item_id,
        amount: line.unit_price,
        status:
          params.orderInitialStatus === "completed" ? "active" : "pending",
      })
      .select("id")
      .single()
    if (subscription && params.orderInitialStatus === "completed") {
      await syncSubscriptionEntitlements(subscription.id, params.isAdmin)
    }
  }

  const kitchenDelta = kitchenDeltaForSend({
    intent: params.intent,
    existingItems: params.existingItems,
    nextItems: upsertedItems,
  })
  if (params.clientMutationId && params.source === "pos") {
    await recordPosClientMutation({
      siteId: params.siteId,
      clientMutationId: params.clientMutationId,
      kind: "checkout",
      saleId: params.sale.id,
      orderId: params.order.id,
      result: {
        success: true,
        kitchenDelta,
        intent: params.intent || null,
      },
    })
  }

  if (params.quoteForAccept) {
    if (!params.activeQuotationClaim) {
      throw new Error("Quotation checkout claim was lost")
    }
    const completion = await completeQuotationCheckout(params.supabaseAdmin, {
      quotationId: params.quoteForAccept.id,
      claimId: params.activeQuotationClaim.claimId,
      saleId: params.sale.id,
      orderId: params.order.id,
    })
    if ("error" in completion) throw new Error(completion.error)
  }

  // The checkout has already authorized and persisted this exact order. Public
  // buyers may not have RLS permission to update sale_orders, so token creation
  // must use the server-only client or a successful order is reported as failed.
  const tokenResult = await ensurePublicAccessTokenForRecord(
    params.supabaseAdmin,
    "sale_orders",
    params.order.id
  )
  if (tokenResult.error || !tokenResult.token) {
    throw new Error(
      `Failed to create public order link: ${tokenResult.error || "unknown"}`
    )
  }

  const { data: latest } = await params.supabaseAdmin
    .from("sale_orders")
    .select(
      "order_number, status, total, currency, created_at, notes, fulfillment_method"
    )
    .eq("id", params.order.id)
    .single()
  const order = latest ? { ...params.order, ...latest } : params.order
  await tryUpsertPolizaForSale(params.sale.id, params.siteId)

  if (
    params.finalLeadId &&
    params.resolvedUserId &&
    isCommerceLeadSource(params.source)
  ) {
    try {
      await ensureCommerceLeadConverted({
        supabase: queryClient,
        siteId: params.siteId,
        leadId: params.finalLeadId,
        source: params.source,
        userId: params.resolvedUserId,
        amount: params.orderTotal,
        leadName: params.customerName,
        paid: params.orderInitialStatus === "completed",
      })
    } catch (error) {
      console.error("Failed to sync commerce lead conversion:", error)
    }
  }

  return {
    success: true as const,
    saleId: params.sale.id,
    orderId: order.id,
    publicAccessToken: tokenResult.token,
    orderNumber: order.order_number ?? null,
    status: order.status ?? null,
    total: order.total ?? null,
    currency: order.currency ?? null,
    createdAt: order.created_at ?? null,
    kitchenDelta,
    notes: order.notes ?? params.notes ?? null,
    fulfillment: order.fulfillment_method ?? params.fulfillment ?? null,
    quotationCompleted: Boolean(params.quoteForAccept),
  }
}
