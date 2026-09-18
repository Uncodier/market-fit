import { format } from "date-fns"
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion"
import { roundMoney } from "./taxes"
import {
  CheckoutCartParams,
  CheckoutSource,
  CheckoutSupabaseClient,
  ProcessedCheckoutLine,
} from "./checkout-types"
import { QuotationForCheckout } from "@/app/quotations/quote-checkout"

type PersistCheckoutRecordsParams = {
  supabase: CheckoutSupabaseClient
  supabaseAdmin: CheckoutSupabaseClient
  isAdmin: boolean
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
  paymentMethod?: string
  intent?: CheckoutCartParams["intent"]
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
  intent?: CheckoutCartParams["intent"]
) {
  return processedLines.map((line) => ({
    id: line.catalog_item_id,
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.unit_price,
    subtotal: line.subtotal,
    metadata: {
      is_new: intent === "send",
      client_line_key: line.client_line_key,
      parent_client_line_key: line.parent_client_line_key,
      is_modifier: Boolean(line.parent_client_line_key),
      modifier_group_id: line.modifier_group_id,
      parent_name: line.parent_name,
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
  let promoDiscount = 0
  if (params.promotionCode?.trim() || params.promotionId) {
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
    })
    if ("error" in promoPreview) {
      throw new Error(`Promotion failed: ${promoPreview.error}`)
    }
    promoDiscount = promoPreview.data.discount
    resolvedPromotionId = promoPreview.data.promotionId
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

  const totalPaid = (params.payments || []).reduce(
    (sum, payment) => sum + payment.amount,
    0
  )
  const isFullyPaid =
    Boolean(params.payments && totalPaid >= orderTotal) || orderTotal === 0
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
    location_id: params.finalOriginLocationId || null,
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
  }))
  const orderItems = serializedItems(params.processedLines, params.intent)

  if (params.effectiveExistingOrderId) {
    const { data: existingOrder } = await queryClient
      .from("sale_orders")
      .select("sale_id, status")
      .eq("id", params.effectiveExistingOrderId)
      .single()
    if (!existingOrder) throw new Error("Existing order not found")
    const { data: existingSale } = await queryClient
      .from("sales")
      .select("status, amount_due")
      .eq("id", existingOrder.sale_id)
      .single()
    const { data: storedItems } = await queryClient
      .from("sale_order_items")
      .select("*")
      .eq("sale_order_id", params.effectiveExistingOrderId)
    existingItems = storedItems || []

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

    const saleData: any = {
      ...commonSaleData,
      status: saleInitialStatus,
    }
    if (paymentMethodToStore) saleData.payment_method = paymentMethodToStore
    if (params.payments?.length) saleData.payments = paymentRows
    const { data: updatedSale, error: saleError } = await queryClient
      .from("sales")
      .update(saleData)
      .eq("id", existingOrder.sale_id)
      .select()
      .single()
    if (saleError) throw new Error(`Sale error: ${saleError.message}`)
    sale = updatedSale

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
      ...(resolvedPromotionId || normalizedPromotionCode
        ? {
            discount_total: promoDiscount,
            ...(resolvedPromotionId
              ? { promotion_id: resolvedPromotionId }
              : {}),
          }
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
    const { data: updatedOrder, error: orderError } = await queryClient
      .from("sale_orders")
      .update(orderData)
      .eq("id", params.effectiveExistingOrderId)
      .select()
      .single()
    if (orderError) throw new Error(`Order error: ${orderError.message}`)
    order = updatedOrder
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
        order_number: `ORD-${Date.now().toString().slice(-6)}`,
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
