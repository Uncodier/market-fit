"use server"

import { randomUUID } from "node:crypto"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { findPosClientMutation } from "@/app/pos/actions/idempotency"
import {
  assertQuotationCheckoutable,
  claimQuotationCheckout,
  quotationItemsToCheckoutLines,
  releaseQuotationCheckoutClaim,
  type QuotationForCheckout,
} from "@/app/quotations/quote-checkout"
import { isPublicAccessTokenActive } from "@/app/documents/public-token"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"
import { isValidQuotationPublicToken } from "@/app/quotations/public-token"
import { prepareCheckoutEnvironment } from "./checkout-environment"
import { resolveCheckoutAttribution } from "./checkout-attribution"
import { processCheckoutLines } from "./checkout-lines"
import { persistCheckoutRecords } from "./checkout-records"
import { finalizeCheckout } from "./checkout-finalize"
import type { CheckoutCartParams } from "./checkout-types"
import {
  claimCheckoutMutation,
  completeCheckoutMutation,
  releaseCheckoutMutation,
} from "./checkout-idempotency"

export type {
  CheckoutCartParams,
  CheckoutLine,
  CheckoutLineModifier,
} from "./checkout-types"

export async function checkoutCart(params: CheckoutCartParams) {
  let activeQuotationClaim: {
    quotationId: string
    claimId: string
  } | null = null
  let quotationClaimClient: any = null
  let publicMutationClaim: {
    siteId: string
    clientMutationId: string
    ownerToken: string
  } | null = null
  let checkoutAdminClient: any = null
  let publicMutationHasSideEffects = false

  try {
    if (params.clientMutationId && params.source === "pos") {
      const existing = await findPosClientMutation(
        params.siteId,
        params.clientMutationId
      )
      if (existing.data) {
        return {
          success: true,
          saleId: existing.data.sale_id || undefined,
          orderId: existing.data.order_id || undefined,
          idempotent: true,
        }
      }
    }

    const supabase = await createClient()
    const supabaseAdmin = await createServiceClient(true)
    checkoutAdminClient = supabaseAdmin
    const authenticatedUserId =
      (await supabase.auth.getUser()).data.user?.id || null
    const derivesBuyerIdentity = ["shop", "marketplace", "quote"].includes(
      params.source
    )
    const authenticatedBuyerId = derivesBuyerIdentity
      ? authenticatedUserId
      : null

    let lines = params.lines
    let source = params.source
    let priceListId = params.priceListId
    let leadId = params.leadId
    let buyerUserId = derivesBuyerIdentity
      ? authenticatedBuyerId
      : params.buyerUserId
    let effectiveExistingOrderId = params.existingOrderId
    let quoteForAccept: QuotationForCheckout | null = null

    if (params.source === "quote" && !params.quotationId) {
      throw new Error("Quotation reference is required")
    }

    if (params.quotationId) {
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("quotations")
        .select("*, items:quotation_items(*)")
        .eq("id", params.quotationId)
        .single()
      if (quoteError || !quote) throw new Error("Quotation not found")

      const hasPublicAccessToken =
        params.publicAccessToken !== undefined &&
        params.publicAccessToken !== null
      if (
        hasPublicAccessToken &&
        !isValidQuotationPublicToken(params.publicAccessToken)
      ) {
        throw new Error("Invalid quote link")
      }
      const tokenOk =
        hasPublicAccessToken &&
        typeof quote.public_access_token === "string" &&
        quote.public_access_token === params.publicAccessToken &&
        isPublicAccessTokenActive(quote)
      if (hasPublicAccessToken && !tokenOk) {
        throw new Error("This quote link is no longer available")
      }

      const claimId = randomUUID()
      const claim = await claimQuotationCheckout(supabaseAdmin, {
        quotationId: params.quotationId,
        siteId: params.siteId,
        claimId,
        buyerUserId: authenticatedBuyerId,
        publicAccessToken: tokenOk ? params.publicAccessToken : null,
      })
      if (claim.state === "completed") {
        const tokenResult = await ensurePublicAccessTokenForRecord(
          supabaseAdmin,
          "sale_orders",
          claim.orderId
        )
        if (tokenResult.error || !tokenResult.token) {
          throw new Error(
            tokenResult.error || "Failed to create public order link"
          )
        }
        const { data: completedOrder, error: completedOrderError } =
          await supabaseAdmin
            .from("sale_orders")
            .select(
              "id, sale_id, order_number, status, total, currency, created_at, notes, fulfillment_method"
            )
            .eq("id", claim.orderId)
            .eq("sale_id", claim.saleId)
            .single()
        if (completedOrderError || !completedOrder) {
          throw new Error("Completed quotation order not found")
        }
        return {
          success: true,
          saleId: claim.saleId,
          orderId: claim.orderId,
          publicAccessToken: tokenResult.token,
          orderNumber: completedOrder.order_number ?? null,
          status: completedOrder.status ?? null,
          total: completedOrder.total ?? null,
          currency: completedOrder.currency ?? null,
          createdAt: completedOrder.created_at ?? null,
          notes: completedOrder.notes ?? null,
          fulfillment: completedOrder.fulfillment_method ?? null,
          idempotent: true,
        }
      }
      if (claim.state === "error") throw new Error(claim.error)

      activeQuotationClaim = { quotationId: params.quotationId, claimId }
      quotationClaimClient = supabaseAdmin
      const gate = assertQuotationCheckoutable(quote, {
        buyerUserId: authenticatedBuyerId,
        siteId: params.siteId,
        publicAccess: tokenOk,
      })
      if (!gate.ok) throw new Error(gate.error)

      quoteForAccept = quote as QuotationForCheckout
      lines = quotationItemsToCheckoutLines(quote.items || [])
      source = "quote"
      priceListId = quote.price_list_id || undefined
      leadId = quote.lead_id || undefined
      buyerUserId = authenticatedBuyerId

      const { data: existingQuoteOrder, error: existingQuoteOrderError } =
        await supabaseAdmin
          .from("sale_orders")
          .select("id")
          .eq("quotation_id", params.quotationId)
          .maybeSingle()
      if (existingQuoteOrderError) {
        throw new Error(existingQuoteOrderError.message)
      }
      effectiveExistingOrderId = existingQuoteOrder?.id || undefined
    }

    const environment = await prepareCheckoutEnvironment({
      supabase,
      supabaseAdmin,
      siteId: params.siteId,
      lines,
      source,
      inputSource: params.source,
      userId:
        params.source === "pos"
          ? authenticatedUserId || undefined
          : params.userId,
      buyerUserId,
      leadId,
      priceListId,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      fulfillment: params.fulfillment,
      shippingAddress: params.shippingAddress,
      originLocationId: params.originLocationId,
      scheduledFor: params.scheduledFor,
      isStaffMutation: params.isStaffMutation,
    })

    if (source === "shop" || source === "marketplace") {
      if (!params.clientMutationId) {
        throw new Error("An idempotency key is required")
      }
      const claim = await claimCheckoutMutation(supabaseAdmin, {
        siteId: params.siteId,
        clientMutationId: params.clientMutationId,
        source,
      })
      if (claim.state === "error") throw new Error(claim.error)
      if (claim.state === "processing") {
        throw new Error("This checkout is already being processed")
      }
      if (claim.state === "completed") {
        return { ...claim.result, idempotent: true }
      }
      publicMutationClaim = {
        siteId: params.siteId,
        clientMutationId: params.clientMutationId,
        ownerToken: claim.ownerToken,
      }
    }

    const attribution = await resolveCheckoutAttribution({
      supabaseAdmin,
      siteId: params.siteId,
      source,
      authenticatedUserId,
      sellerUserId: params.sellerUserId,
      requestedByLeadId: environment.finalLeadId,
    })

    publicMutationHasSideEffects = Boolean(publicMutationClaim)
    const lineResult = await processCheckoutLines({
      supabase,
      supabaseAdmin,
      siteId: params.siteId,
      lines,
      isAdmin: environment.isAdmin,
      isStaffCheckout: environment.isStaffCheckout,
      siteSettings: environment.siteSettings,
      finalPriceListId: environment.finalPriceListId,
      priceListChannel: environment.priceListChannel,
      finalLeadId: environment.finalLeadId,
      originLocationId: params.originLocationId,
      existingReservationId: params.existingReservationId,
      effectiveExistingOrderId,
      fulfillment: params.fulfillment,
    })

    const records = await persistCheckoutRecords({
      supabase,
      supabaseAdmin,
      isAdmin: environment.isAdmin,
      siteId: params.siteId,
      source,
      buyerUserId,
      ownerSiteId: params.ownerSiteId,
      finalLeadId: environment.finalLeadId,
      finalPriceListId: environment.finalPriceListId,
      finalOriginLocationId: environment.finalOriginLocationId,
      resolvedScheduledFor: environment.resolvedScheduledFor,
      resolvedUserId: environment.resolvedUserId,
      leadCampaignId: environment.leadCampaignId,
      leadSegmentId: environment.leadSegmentId,
      leadCompanyId: environment.leadCompanyId,
      promotionCode: params.promotionCode,
      promotionId: params.promotionId,
      fulfillment: params.fulfillment,
      shippingAddress: params.shippingAddress,
      payments: params.payments,
      paymentMethod: params.paymentMethod,
      intent: params.intent,
      notes: params.notes,
      effectiveExistingOrderId,
      quoteForAccept,
      ...attribution,
      ...lineResult,
    })

    const result = await finalizeCheckout({
      supabase,
      supabaseAdmin,
      isAdmin: environment.isAdmin,
      isStaffCheckout: environment.isStaffCheckout,
      siteId: params.siteId,
      source,
      lines,
      processedLines: lineResult.processedLines,
      sale: records.sale,
      order: records.order,
      existingItems: records.existingItems,
      effectiveExistingOrderId,
      intent: params.intent,
      isFullyPaid: records.isFullyPaid,
      orderInitialStatus: records.orderInitialStatus,
      normalizedPromotionCode: records.normalizedPromotionCode,
      resolvedPromotionId: records.resolvedPromotionId,
      fulfillment: params.fulfillment,
      finalOriginLocationId: environment.finalOriginLocationId,
      resolvedUserId: environment.resolvedUserId,
      finalLeadId: environment.finalLeadId,
      buyerUserId,
      ownerSiteId: params.ownerSiteId,
      existingReservationId: params.existingReservationId,
      shippingAddress: params.shippingAddress,
      clientMutationId: params.clientMutationId,
      quoteForAccept,
      activeQuotationClaim,
      customerName: params.customerName,
      orderTotal: records.orderTotal,
      notes: params.notes,
    })
    if (result.quotationCompleted) activeQuotationClaim = null
    const { quotationCompleted: _, ...checkoutResult } = result
    if (publicMutationClaim) {
      const completedClaim = publicMutationClaim
      publicMutationClaim = null
      await completeCheckoutMutation(supabaseAdmin, {
        ...completedClaim,
        result: checkoutResult,
      })
    }
    return checkoutResult
  } catch (error: any) {
    if (
      publicMutationClaim &&
      checkoutAdminClient &&
      !publicMutationHasSideEffects
    ) {
      await releaseCheckoutMutation(checkoutAdminClient, publicMutationClaim)
    }
    if (activeQuotationClaim && quotationClaimClient) {
      await releaseQuotationCheckoutClaim(
        quotationClaimClient,
        activeQuotationClaim.quotationId,
        activeQuotationClaim.claimId
      )
    }
    return { error: error.message }
  }
}
