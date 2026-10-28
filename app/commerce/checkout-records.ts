import { format } from "date-fns"
import { randomUUID } from "node:crypto"
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion"
import { loadRecordedCheckoutPromotion, recordedPromotionVersion } from "./checkout-recorded-promotion"
import { roundMoney } from "./taxes"
import {
  CheckoutCartParams,
  CheckoutSource,
  CheckoutSupabaseClient,
  ProcessedCheckoutLine,
} from "./checkout-types"
import { QuotationForCheckout } from "@/app/quotations/quote-checkout"
import { resolveCheckoutPaymentState } from "./checkout-payment-state"
import { newRegisterReceipts } from "@/app/pos/register/receipt-retries"
import type { PosCheckoutClaim } from "@/app/pos/checkout-attempt-server"
import { isSelfServiceOrder, selfServiceLocationFromItems, selfServiceMetadata } from "./self-service-lifecycle"

type PersistCheckoutRecordsParams = {
  supabase: CheckoutSupabaseClient
  supabaseAdmin: CheckoutSupabaseClient
  isAdmin: boolean
  publicCheckout?: boolean
  siteId: string
  source: CheckoutSource
  buyerUserId?: string | null
  ownerSiteId?: string | null
  finalLeadId?: string
  finalPriceListId?: string
  finalOriginLocationId?: string
  resolvedScheduledFor?: string
  resolvedUserId?: string
  createdByUserId?: string | null
  sellerUserId?: string | null
  requestedByLeadId?: string | null
  leadCampaignId?: string | null
  leadSegmentId?: string | null
  leadCompanyId?: string | null
  promotionCode?: string
  promotionId?: string
  fulfillment: CheckoutCartParams["fulfillment"]
  shippingAddress?: any
  payments?: CheckoutCartParams["payments"]
  registerSessionId?: string
  registerActorId?: string
  posClaim?: PosCheckoutClaim | null
  paymentMethod?: string
  intent?: CheckoutCartParams["intent"]
  selfServiceLocationId?: string
  notes?: string
  effectiveExistingOrderId?: string
  quoteForAccept: QuotationForCheckout | null
  processedLines: ProcessedCheckoutLine[]
  orderSubtotal: number
  orderTaxTotal: number
  orderShippingCost: number
  orderCurrency: string
}

function serializedItems(
  processedLines: ProcessedCheckoutLine[],
  intent?: CheckoutCartParams["intent"],
  selfServiceLocationId?: string,
  selfService = Boolean(selfServiceLocationId),
) {
  return processedLines.map((line) => ({
    id: line.catalog_item_id,
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.unit_price,
    subtotal: line.subtotal,
    metadata: {
      is_new: intent === "send",
      ...selfServiceMetadata(selfServiceLocationId, selfService),
      client_line_key: line.client_line_key,
      parent_client_line_key: line.parent_client_line_key,
      is_modifier: Boolean(line.parent_client_line_key),
      modifier_group_id: line.modifier_group_id,
      parent_name: line.parent_name,
      ...(line.backorder_quantity !== undefined
        ? { backorder_quantity: line.backorder_quantity }
        : {}),
    },
  }))
}

export async function persistCheckoutRecords(
  params: PersistCheckoutRecordsParams
) {
  const queryClient = params.isAdmin ? params.supabaseAdmin : params.supabase
  let orderTotal = roundMoney(
    params.orderSubtotal +
      params.orderTaxTotal +
      params.orderShippingCost
  )
  let normalizedPromotionCode: string | undefined
  let resolvedPromotionId: string | undefined
  let recordedPromotionId: string | undefined
  let recordedPromotionBaseline: string | undefined
  let promoDiscount = 0
  if (params.promotionCode?.trim() || params.promotionId) {
    const recorded = await loadRecordedCheckoutPromotion(queryClient, params)
    if (recorded) {
      promoDiscount = recorded.discount
      recordedPromotionId = recorded.promotionId
      recordedPromotionBaseline = recorded.version
    } else {
      normalizedPromotionCode = params.promotionCode?.trim()
        ? params.promotionCode.trim().toUpperCase()
        : undefined
      resolvedPromotionId = params.promotionId
      const promoPreview = await resolvePromotionDiscount({
        siteId: params.siteId,
        code: normalizedPromotionCode,
        promotionId: resolvedPromotionId,
        lines: params.processedLines.map((line) => ({
          catalogItemId: line.catalog_item_id,
          subtotal: line.subtotal,
          quantity: line.quantity,
        })),
        buyerUserId: params.buyerUserId,
        leadId: params.finalLeadId,
        source: params.source,
        locationId: params.finalOriginLocationId || null,
        excludeOrderId: params.effectiveExistingOrderId || null,
        forceServiceRole: params.isAdmin,
      }, queryClient)
      if ("error" in promoPreview) {
        throw new Error(`Promotion failed: ${promoPreview.error}`)
      }
      promoDiscount = promoPreview.data.discount
      resolvedPromotionId = promoPreview.data.promotionId
    }
    orderTotal = roundMoney(
      Math.max(
        0,
        params.orderSubtotal -
          promoDiscount +
          params.orderTaxTotal +
          params.orderShippingCost
      )
    )
  }

  let paymentState = resolveCheckoutPaymentState(
    orderTotal,
    [],
    params.payments,
  )
  let totalPaid = paymentState.totalPaid
  let isFullyPaid = paymentState.isFullyPaid
  let saleInitialStatus = "pending"
  let orderInitialStatus = "pending"
  if (params.intent === "complete") {
    saleInitialStatus = isFullyPaid ? "completed" : "pending"
    orderInitialStatus = "completed"
  } else if (params.intent === "pay") {
    saleInitialStatus = isFullyPaid ? "completed" : "pending"
    orderInitialStatus = isFullyPaid ? "completed" : "pending"
  } else if (!["send", "draft"].includes(params.intent || "")) {
    saleInitialStatus = isFullyPaid ? "completed" : "pending"
    orderInitialStatus = saleInitialStatus
  }
  if (params.publicCheckout) {
    saleInitialStatus = isFullyPaid ? "completed" : "pending"
    orderInitialStatus = saleInitialStatus
  }
  if (params.selfServiceLocationId) {
    saleInitialStatus = isFullyPaid ? "completed" : "pending"
    orderInitialStatus = "pending"
  }

  const paymentMethodToStore = params.payments?.length
    ? params.payments.length === 1
      ? params.payments[0].method
      : "multiple"
    : params.paymentMethod
  let existingItems: any[] = []
  let sale: any
  let order: any

  const commonSaleData = {
    site_id: params.siteId,
    lead_id: params.finalLeadId,
    buyer_user_id: params.buyerUserId || null,
    owner_site_id: params.ownerSiteId || null,
    // A quote's canonical scope wins even when unresolved. Fulfillment is separate.
    ...(params.quoteForAccept
      ? params.quoteForAccept.location_id !== undefined ? { location_id: params.quoteForAccept.location_id } : {}
      : { location_id: params.finalOriginLocationId || null }),
    campaign_id: params.leadCampaignId,
    segment_id: params.leadSegmentId,
    company_id: params.leadCompanyId,
    title: `Order - ${new Date().toLocaleDateString()}`,
    product_name: params.processedLines[0]?.name,
    amount: orderTotal,
    amount_due: params.payments
      ? Math.max(0, orderTotal - totalPaid)
      : orderTotal,
    currency: params.orderCurrency,
    user_id: params.resolvedUserId,
    sale_date: format(new Date(), "yyyy-MM-dd"),
    source: params.source,
    ...(params.quoteForAccept
      ? { quotation_id: params.quoteForAccept.id }
      : {}),
  }
  const paymentRows = (params.payments || []).map((payment) => ({
    method: payment.method,
    amount: payment.amount,
    tendered: payment.tendered || payment.amount,
    change: payment.change || 0,
    date: new Date().toISOString(),
    status: "completed",
    ...(params.source === "pos" && params.registerSessionId ? {
      register_session_id: params.registerSessionId,
      payment_id: payment.paymentId,
      recorded_by: params.registerActorId,
    } : {}),
  }))
  let orderItems = serializedItems(params.processedLines, params.intent, params.selfServiceLocationId)

  if (params.effectiveExistingOrderId) {
    const { data: existingOrder } = await queryClient
      .from("sale_orders")
      .select("sale_id, status, total, currency, notes, updated_at, items, promotion_id, discount_total, subtotal, tax_total, shipping_cost, buyer_user_id, origin_location_id, fulfillment_method")
      .eq("id", params.effectiveExistingOrderId)
      .single()
    if (!existingOrder) throw new Error("Existing order not found")
    const { data: existingSale } = await queryClient
      .from("sales")
      .select("status, amount, amount_due, payments, source, lead_id")
      .eq("id", existingOrder.sale_id)
      .single()
    if (!existingSale) throw new Error("Existing sale is unavailable. No payment was collected.")
    if (recordedPromotionBaseline && (recordedPromotionVersion(existingOrder) !== recordedPromotionBaseline ||
      (existingSale.lead_id || null) !== (params.finalLeadId || null))) {
      throw new Error("The recorded promotion changed. Reload the order before payment.")
    }
    const { data: storedItems } = await queryClient
      .from("sale_order_items")
      .select("*")
      .eq("sale_order_id", params.effectiveExistingOrderId)
    existingItems = storedItems || []
    const existingPaymentRows = Array.isArray(existingSale?.payments)
      ? existingSale.payments
      : []
    paymentState = resolveCheckoutPaymentState(
      orderTotal,
      existingPaymentRows,
      newRegisterReceipts(existingPaymentRows, paymentRows),
      {
        amount: existingSale?.amount,
        amountDue: existingSale?.amount_due,
      },
    )
    totalPaid = paymentState.totalPaid
    isFullyPaid = paymentState.isFullyPaid

    if (params.intent === "complete") {
      saleInitialStatus = isFullyPaid ? "completed" : "pending"
      orderInitialStatus = "completed"
    } else if (params.intent === "pay") {
      saleInitialStatus = isFullyPaid ? "completed" : "pending"
      orderInitialStatus = isFullyPaid ? "completed" : existingOrder.status
    }

    const hasNewOrChangedLines = params.processedLines.some((line) => {
      const existingItem = existingItems.find((item: any) => {
        if (
          line.client_line_key &&
          item.metadata?.client_line_key === line.client_line_key
        ) {
          return true
        }
        return (
          !line.parent_client_line_key &&
          !item.parent_sale_order_item_id &&
          !item.metadata?.client_line_key &&
          item.catalog_item_id === line.catalog_item_id
        )
      })
      return !existingItem || line.quantity > existingItem.quantity
    })

    if (params.intent === "send") {
      if (hasNewOrChangedLines) {
        orderInitialStatus = "pending"
        saleInitialStatus =
          existingSale?.amount_due > 0 || !isFullyPaid
            ? "pending"
            : existingSale?.status || "completed"
      } else {
        orderInitialStatus = existingOrder.status
        saleInitialStatus = existingSale?.status || "completed"
      }
    } else if (params.intent === "draft") {
      orderInitialStatus = existingOrder.status
      saleInitialStatus = existingSale?.status || "pending"
    } else if (!["complete", "pay"].includes(params.intent || "")) {
      orderInitialStatus =
        existingOrder.status === "completed" && !isFullyPaid
          ? "completed"
          : orderInitialStatus
      saleInitialStatus =
        existingSale?.status === "completed" && !isFullyPaid
          ? "completed"
          : saleInitialStatus
    }

    const selfService = isSelfServiceOrder(existingOrder) || isSelfServiceOrder({ items: existingItems })
    if (selfService) {
      saleInitialStatus = isFullyPaid ? "completed" : "pending"
      // Payment settles the sale, not kitchen work. Preserve kitchen progress.
      orderInitialStatus = ["in_progress", "completed", "cancelled"].includes(existingOrder.status)
        ? existingOrder.status : "pending"
      orderItems = serializedItems(params.processedLines, params.intent,
        selfServiceLocationFromItems(existingOrder.items) || selfServiceLocationFromItems(existingItems), true)
    }

    const saleData: any = {
      ...commonSaleData,
      amount_due: Math.max(0, orderTotal - totalPaid),
      status: saleInitialStatus,
      ...(selfService ? { source: existingSale.source || "shop" } : {}),
    }
    // Editing fulfillment must not silently reassign an existing sale's scope.
    delete saleData.location_id
    if (paymentMethodToStore) saleData.payment_method = paymentMethodToStore
    if (params.payments?.length) {
      saleData.payments = paymentState.payments
    }
    const orderData = {
      price_list_id: params.finalPriceListId,
      buyer_user_id: params.buyerUserId || null,
      owner_site_id: params.ownerSiteId || null,
      fulfillment_method: params.fulfillment,
      origin_location_id: params.finalOriginLocationId || null,
      shipping_address: params.shippingAddress || null,
      scheduled_for: params.resolvedScheduledFor || null,
      subtotal: params.orderSubtotal,
      tax_total: params.orderTaxTotal,
      shipping_cost: params.orderShippingCost,
      total: orderTotal,
      currency: params.orderCurrency,
      ...(recordedPromotionId || resolvedPromotionId || normalizedPromotionCode
        ? { discount_total: promoDiscount, promotion_id: recordedPromotionId || resolvedPromotionId }
        : {}),
      status: orderInitialStatus,
      user_id: params.resolvedUserId,
      seller_user_id: params.sellerUserId || null,
      requested_by_lead_id: params.requestedByLeadId || null,
      items: orderItems,
      ...(params.notes !== undefined
        ? { notes: params.notes.trim() || null }
        : {}),
      ...(params.quoteForAccept
        ? { quotation_id: params.quoteForAccept.id }
        : {}),
    }
    if (params.source === "pos" && params.posClaim && params.payments?.length) {
      const { data: committed, error } = await params.supabaseAdmin.rpc("pos_checkout_commit_order", {
        p_site_id: params.siteId, p_mutation_id: params.posClaim.mutationId,
        p_owner_token: params.posClaim.ownerToken, p_order_id: params.effectiveExistingOrderId,
        p_sale_patch: saleData, p_order_patch: orderData,
        p_expected_sale: { amount: existingSale?.amount, amount_due: existingSale?.amount_due, payments: existingSale?.payments,
          ...(recordedPromotionBaseline ? { lead_id: existingSale.lead_id || null } : {}) },
        p_expected_order: existingOrder,
      })
      if (error || !committed?.sale || !committed?.order) throw new Error("Payment and order could not be committed. Check payment status before retrying.")
      sale = committed.sale
      order = committed.order
    } else {
      const { data: updatedSale, error: saleError } = await queryClient.from("sales")
        .update(saleData).eq("id", existingOrder.sale_id).select().single()
      if (saleError) throw new Error(`Sale error: ${saleError.message}`)
      sale = updatedSale
      const { data: updatedOrder, error: orderError } = await queryClient.from("sale_orders")
        .update(orderData).eq("id", params.effectiveExistingOrderId).select().single()
      if (orderError) throw new Error(`Order error: ${orderError.message}`)
      order = updatedOrder
    }
  } else {
    const saleData = {
      ...commonSaleData,
      accounting_state: "pending",
      status: saleInitialStatus,
      payment_method: paymentMethodToStore,
      payments: paymentRows,
    }
    let existingQuoteSale: any = null
    if (params.quoteForAccept) {
      const { data, error } = await params.supabaseAdmin
        .from("sales")
        .select("id")
        .eq("quotation_id", params.quoteForAccept.id)
        .maybeSingle()
      if (error) throw new Error(`Sale error: ${error.message}`)
      existingQuoteSale = data
    }
    const saleWrite = existingQuoteSale
      ? queryClient.from("sales").update(saleData).eq("id", existingQuoteSale.id)
      : queryClient.from("sales").insert(saleData)
    const { data: writtenSale, error: saleError } = await saleWrite
      .select()
      .single()
    if (saleError) throw new Error(`Sale error: ${saleError.message}`)
    sale = writtenSale

    const { data: newOrder, error: orderError } = await queryClient
      .from("sale_orders")
      .insert({
        site_id: params.siteId,
        sale_id: sale.id,
        ...(params.quoteForAccept?.location_id !== undefined
          ? { location_id: params.quoteForAccept.location_id }
          : {}),
        price_list_id: params.finalPriceListId,
        buyer_user_id: params.buyerUserId || null,
        owner_site_id: params.ownerSiteId || null,
        fulfillment_method: params.fulfillment,
        origin_location_id: params.finalOriginLocationId || null,
        shipping_address: params.shippingAddress || null,
        scheduled_for: params.resolvedScheduledFor || null,
        subtotal: params.orderSubtotal,
        tax_total: params.orderTaxTotal,
        shipping_cost: params.orderShippingCost,
        total: orderTotal,
        currency: params.orderCurrency,
        discount_total: promoDiscount,
        ...(resolvedPromotionId
          ? { promotion_id: resolvedPromotionId }
          : {}),
        status: orderInitialStatus,
        order_number: params.selfServiceLocationId
          ? `K-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`
          : `ORD-${Date.now().toString().slice(-6)}`,
        user_id: params.resolvedUserId,
        created_by_user_id: params.createdByUserId || null,
        seller_user_id: params.sellerUserId || null,
        requested_by_lead_id: params.requestedByLeadId || null,
        notes: params.notes?.trim() || null,
        ...(params.quoteForAccept
          ? { quotation_id: params.quoteForAccept.id }
          : {}),
        items: orderItems,
      })
      .select()
      .single()
    if (orderError) throw new Error(`Order error: ${orderError.message}`)
    order = newOrder
  }

  return {
    sale,
    order,
    existingItems,
    isFullyPaid,
    saleInitialStatus,
    orderInitialStatus,
    normalizedPromotionCode,
    resolvedPromotionId,
    orderTotal,
  }
}
