"use server"

import { randomUUID } from "node:crypto"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { findPosClientMutation } from "@/app/pos/actions/idempotency"
import { assertPosOrderCurrent } from "@/app/pos/assert-order-current"
import { assertRegisterCheckout } from "@/app/pos/register/checkout-guard"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"
import { claimPosCheckout, transitionPosCheckout, posCheckoutFingerprint, type PosCheckoutClaim } from "@/app/pos/checkout-attempt-server"
import { PosCheckoutRecoveryError } from "@/app/pos/checkout-recovery-types"
import { inspectPosPayment } from "@/app/pos/payment-recovery-server"
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
import { prepareSelfServiceCheckout } from "./self-service"
import { authorizeCheckoutBoundary } from "./checkout-boundary"
import { verifySiteMembership } from "@/app/buyer/verify-site-membership"
import { markPublicCheckoutReady, publicCheckoutFingerprint, recoverPublicCheckout, type PublicCheckoutClaim } from "./public-checkout-recovery"
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
  let publicMutationClaim: PublicCheckoutClaim | null = null
  let checkoutAdminClient: any = null
  let publicMutationHasSideEffects = false
  let posClaim: PosCheckoutClaim | null = null
  let posWritesStarted = false
  let publicCheckout = ["shop", "marketplace", "quote"].includes(params?.source) && params?.isStaffMutation !== true
  let publicAttemptUncertain = false

  try {
    const boundary = await authorizeCheckoutBoundary(params)
    params = boundary.params
    publicCheckout = boundary.publicCheckout
    if (params.source === 'pos') {
      const access = await requirePosSiteAccess(params.siteId)
      if ('error' in access) return { error: access.error }
      if (params.payments?.length && !["owner", "admin", "collaborator"].includes(access.role)) {
        return { error: "Forbidden POS payment." }
      }
      if (params.payments?.length && !params.clientMutationId) return { error: "A stable checkout identity is required for POS payment." }
    }
    if (params.clientMutationId && params.source === "pos" && !params.payments?.length) {
      const existing = await findPosClientMutation(
        params.siteId,
        params.clientMutationId
      )
      if (existing.error) throw new Error("Unable to verify the original checkout result. Check payment status before retrying.")
      if (existing.data) {
        if (existing.data.kind !== "checkout" || existing.data.result?.success !== true ||
          !existing.data.sale_id || !existing.data.order_id) {
          throw new Error("The checkout identity is already used by another operation. Review it before retrying.")
        }
        const recovered = { ...existing.data.result, success: true as const,
          saleId: existing.data.sale_id, orderId: existing.data.order_id }
        return { ...recovered, idempotent: true }
      }
    }

    const supabase = await createClient()
    const supabaseAdmin = checkoutAdminClient || await createServiceClient(true, {
      access: ['shop', 'marketplace', 'quote'].includes(params.source) ? 'public' : 'workspace',
    })
    checkoutAdminClient = supabaseAdmin
    const authenticatedUserId = (await supabase.auth.getUser()).data.user?.id || null
    if (boundary.publicCheckout && params.ownerSiteId && !params.selfServiceLocationId &&
      (!authenticatedUserId || !await verifySiteMembership(supabase, authenticatedUserId, params.ownerSiteId))) {
      throw new Error("You cannot assign this purchase to that account.")
    }
    if (boundary.publicCheckout && ["shop", "marketplace"].includes(params.source)) {
      if (!params.clientMutationId) throw new Error("An idempotency key is required")
      const fingerprint = publicCheckoutFingerprint(params, authenticatedUserId)
      publicAttemptUncertain = true
      const claim = await claimCheckoutMutation(supabaseAdmin, { siteId: params.siteId,
        clientMutationId: params.clientMutationId, source: params.source, fingerprint, recoveryLocationId: params.selfServiceLocationId })
      if (claim.state === "error") throw new Error(claim.error)
      if (claim.state === "processing") throw new Error("This checkout is being processed or requires staff review. Retry this same attempt; do not place another order.")
      if (claim.state === "completed") return await recoverPublicCheckout(supabaseAdmin, params.siteId, claim.result)
      const identity = { siteId: params.siteId, clientMutationId: params.clientMutationId, ownerToken: claim.ownerToken, fingerprint, recoveryLocationId: params.selfServiceLocationId }
      if (claim.state === "ready") return await recoverPublicCheckout(supabaseAdmin, params.siteId, claim.result, identity)
      publicMutationClaim = identity
      publicAttemptUncertain = false
    }
    const selfService = params.selfServiceLocationId !== undefined
      ? await prepareSelfServiceCheckout(params, supabaseAdmin) : null
    if (selfService && selfService.params.siteId !== params.siteId) throw new Error("Self-service location does not belong to this shop.")
    if (selfService) params = selfService.params
    if (params.source === "pos" && params.clientMutationId) {
      if (!authenticatedUserId) throw new Error("Authentication is required for POS checkout.")
      if (params.payments?.length && params.payments.every((p) => !!p.paymentId)) {
        const evidence = await inspectPosPayment(supabaseAdmin, {
          siteId: params.siteId, clientMutationId: params.clientMutationId,
          existingOrderId: params.existingOrderId, registerSessionId: params.registerSessionId,
          payments: params.payments.map((p) => ({ ...p, paymentId: p.paymentId! })),
          fingerprint: posCheckoutFingerprint(params),
        }, authenticatedUserId)
        if (evidence.state === "completed" && evidence.result) return { ...evidence.result, idempotent: true }
        if (evidence.state !== "not_found") throw new PosCheckoutRecoveryError(evidence)
      }
      const admission = await claimPosCheckout(supabaseAdmin, params, authenticatedUserId)
      if (admission.recovery) return { ...admission.recovery.result!, idempotent: true }
      posClaim = admission.claim
    }
    await assertRegisterCheckout(supabase, params, authenticatedUserId)
    if (params.source === "pos" && params.existingOrderId && params.expectedOrderVersion !== undefined) {
      await assertPosOrderCurrent(params.siteId, params.existingOrderId, params.expectedOrderVersion)
    }
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
      ? selfService ? selfService.buyerUserId : authenticatedBuyerId
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
      ...(selfService ? { selfServiceLocationId: params.selfServiceLocationId } : {}),
    })

    const attribution = await resolveCheckoutAttribution({
      supabaseAdmin,
      siteId: params.siteId,
      source,
      authenticatedUserId: selfService ? null : authenticatedUserId,
      sellerUserId: params.sellerUserId,
      requestedByLeadId: environment.finalLeadId,
    })

    publicMutationHasSideEffects = Boolean(publicMutationClaim) && !selfService
    // Reservations/line preparation may write too. Persist the boundary first;
    // any failure afterward is ambiguous, never a safe-to-recollect rejection.
    if (posClaim) {
      await transitionPosCheckout(supabaseAdmin, posClaim, "writes_started")
      posWritesStarted = true
    }
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
      originLocationId: environment.finalOriginLocationId,
      existingReservationId: params.existingReservationId,
      effectiveExistingOrderId,
      fulfillment: params.fulfillment,
      ...(selfService ? { selfServiceLocationId: params.selfServiceLocationId } : {}),
      ...(boundary.publicCheckout ? { publicCheckout: true } : {}),
    })

    publicMutationHasSideEffects = Boolean(publicMutationClaim)
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
      ...(selfService ? { selfServiceLocationId: params.selfServiceLocationId } : {}),
      leadCampaignId: environment.leadCampaignId,
      ...(boundary.publicCheckout ? { publicCheckout: true } : {}),
      leadSegmentId: environment.leadSegmentId,
      leadCompanyId: environment.leadCompanyId,
      promotionCode: params.promotionCode,
      promotionId: params.promotionId,
      fulfillment: params.fulfillment,
      shippingAddress: params.shippingAddress,
      payments: params.payments,
      registerSessionId: params.source === "pos" ? params.registerSessionId : undefined,
      registerActorId: authenticatedUserId || undefined,
      posClaim,
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
      ...(boundary.publicCheckout ? { publicCheckout: true } : {}),
      ...(selfService ? { selfServiceLocationId: params.selfServiceLocationId } : {}),
      notes: params.notes,
      ...(publicMutationClaim ? { onReadyForPublicToken: () => markPublicCheckoutReady(supabaseAdmin, publicMutationClaim!, records) } : {}),
    })
    if (result.quotationCompleted) activeQuotationClaim = null
    const { quotationCompleted: _, ...checkoutResult } = result
    if (posClaim) {
      await transitionPosCheckout(supabaseAdmin, posClaim, "completed", checkoutResult)
      posClaim = null
    }
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
    if (posClaim && checkoutAdminClient) {
      try {
        await transitionPosCheckout(checkoutAdminClient, posClaim, posWritesStarted ? "review_required" : "rejected")
      } catch {
        // A missing outcome keeps durable admission unresolved; never replay it blindly.
      }
    }
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
    if (error instanceof PosCheckoutRecoveryError) return { error: error.message, recovery: error.recovery }
    return { error: error.message,
      ...(publicCheckout ? { checkoutState: publicMutationHasSideEffects || publicAttemptUncertain ? "uncertain" as const : "rejected" as const } : {}) }
  }
}
