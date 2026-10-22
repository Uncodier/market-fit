/** @jest-environment node */
import { checkoutCart } from "@/app/commerce/checkout"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requirePrivateCommerceSiteAccess } from "@/app/commerce/private-site-access"
import { verifySiteMembership } from "@/app/buyer/verify-site-membership"
import { prepareSelfServiceCheckout } from "@/app/commerce/self-service"
import { prepareCheckoutEnvironment } from "@/app/commerce/checkout-environment"
import { resolveCheckoutAttribution } from "@/app/commerce/checkout-attribution"
import { processCheckoutLines } from "@/app/commerce/checkout-lines"
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import { finalizeCheckout } from "@/app/commerce/checkout-finalize"
import { claimCheckoutMutation, completeCheckoutMutation, releaseCheckoutMutation } from "@/app/commerce/checkout-idempotency"
import { markPublicCheckoutReady, recoverPublicCheckout } from "@/app/commerce/public-checkout-recovery"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/app/commerce/private-site-access", () => ({ requirePrivateCommerceSiteAccess: jest.fn() }))
jest.mock("@/app/buyer/verify-site-membership", () => ({ verifySiteMembership: jest.fn() }))
jest.mock("@/app/commerce/self-service", () => ({ prepareSelfServiceCheckout: jest.fn() }))
jest.mock("@/app/commerce/checkout-environment", () => ({ prepareCheckoutEnvironment: jest.fn() }))
jest.mock("@/app/commerce/checkout-attribution", () => ({ resolveCheckoutAttribution: jest.fn() }))
jest.mock("@/app/commerce/checkout-lines", () => ({ processCheckoutLines: jest.fn() }))
jest.mock("@/app/commerce/checkout-records", () => ({ persistCheckoutRecords: jest.fn() }))
jest.mock("@/app/commerce/checkout-finalize", () => ({ finalizeCheckout: jest.fn() }))
jest.mock("@/app/commerce/checkout-idempotency", () => ({
  claimCheckoutMutation: jest.fn(), completeCheckoutMutation: jest.fn(), releaseCheckoutMutation: jest.fn(),
}))
// Keep the actual request/actor fingerprint, as well as the actual action boundary and normalizer.
jest.mock("@/app/commerce/public-checkout-recovery", () => ({
  ...jest.requireActual("@/app/commerce/public-checkout-recovery"),
  markPublicCheckoutReady: jest.fn(), recoverPublicCheckout: jest.fn(),
}))
jest.mock("@/app/pos/actions/idempotency", () => ({ findPosClientMutation: jest.fn() }))
jest.mock("@/app/pos/assert-order-current", () => ({ assertPosOrderCurrent: jest.fn() }))
jest.mock("@/app/pos/register/checkout-guard", () => ({ assertRegisterCheckout: jest.fn() }))
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }))
jest.mock("@/app/pos/checkout-attempt-server", () => ({
  claimPosCheckout: jest.fn(), transitionPosCheckout: jest.fn(), posCheckoutFingerprint: jest.fn(),
}))
jest.mock("@/app/pos/payment-recovery-server", () => ({ inspectPosPayment: jest.fn() }))
jest.mock("@/app/quotations/quote-checkout", () => ({
  assertQuotationCheckoutable: jest.fn(), claimQuotationCheckout: jest.fn(),
  quotationItemsToCheckoutLines: jest.fn(), releaseQuotationCheckoutClaim: jest.fn(),
}))
jest.mock("@/app/documents/public-token-store", () => ({ ensurePublicAccessTokenForRecord: jest.fn() }))

const request: CheckoutCartParams = {
  siteId: "shop-site", source: "shop", fulfillment: "pickup",
  lines: [{ catalogItemId: "product", quantity: 1 }],
  clientMutationId: "caller-checkout-attempt-0001",
}
const kioskRequest: CheckoutCartParams = {
  ...request, selfServiceLocationId: "location", buyerIdentityQr: "original-account-qr",
}
const records = {
  sale: { id: "persisted-sale" }, order: { id: "persisted-order" }, existingItems: [],
  isFullyPaid: false, saleInitialStatus: "pending", orderInitialStatus: "pending",
  normalizedPromotionCode: undefined, resolvedPromotionId: undefined, orderTotal: 125,
}
const confirmation = {
  success: true as const, saleId: records.sale.id, orderId: records.order.id,
  publicAccessToken: "persisted-order-public-token", orderNumber: "K-SERVER",
  status: "pending", total: 125, currency: "USD", createdAt: "2026-01-01T00:00:00Z",
  notes: null, fulfillment: "pickup",
}
const userClient = { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() }
const adminClient = { from: jest.fn(() => { throw new Error("Unexpected direct database access") }) }

function expectNoCheckoutEffects() {
  for (const effect of [prepareSelfServiceCheckout, prepareCheckoutEnvironment, resolveCheckoutAttribution,
    processCheckoutLines, persistCheckoutRecords, finalizeCheckout, markPublicCheckoutReady]) {
    expect(effect).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  adminClient.from.mockImplementation(() => { throw new Error("Unexpected direct database access") })
  userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "session-buyer" } }, error: null })
  jest.mocked(createClient).mockResolvedValue(userClient as never)
  jest.mocked(createServiceClient).mockResolvedValue(adminClient as never)
  jest.mocked(requirePrivateCommerceSiteAccess).mockResolvedValue({ error: "Not authenticated" })
  jest.mocked(verifySiteMembership).mockResolvedValue(true)
  jest.mocked(claimCheckoutMutation).mockResolvedValue({ state: "claimed", ownerToken: "claim-owner" })
  jest.mocked(prepareSelfServiceCheckout).mockImplementation(async (params) => ({
    params: { ...params, customerName: undefined, customerEmail: undefined }, buyerUserId: "qr-buyer",
  }))
  jest.mocked(prepareCheckoutEnvironment).mockResolvedValue({
    isAdmin: true, isStaffCheckout: false, queryClient: adminClient, siteSettings: {},
    resolvedUserId: "site-owner", resolvedScheduledFor: undefined, finalOriginLocationId: "server-location",
    finalLeadId: "server-lead", finalPriceListId: "server-prices", leadCampaignId: undefined,
    leadSegmentId: undefined, leadCompanyId: undefined, priceListChannel: "shop",
  })
  jest.mocked(resolveCheckoutAttribution).mockResolvedValue({
    createdByUserId: "session-buyer", sellerUserId: null, requestedByLeadId: "server-lead",
  })
  jest.mocked(processCheckoutLines).mockResolvedValue({
    processedLines: [], orderSubtotal: 125, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
  })
  jest.mocked(persistCheckoutRecords).mockResolvedValue(records)
  jest.mocked(finalizeCheckout).mockResolvedValue({ ...confirmation, quotationCompleted: false } as never)
  jest.mocked(recoverPublicCheckout).mockResolvedValue(confirmation)
})

describe("checkoutCart public Server Action boundary", () => {
  it.each(["shop", "marketplace", "quote"] as const)("rejects forged order/payment fields in %s without a kiosk flag", async (source) => {
    for (const attack of [{ existingOrderId: "victim-order" }, { payments: [{ method: "cash", amount: 125 }] }, { payments: [] }]) {
      const result = await checkoutCart({ ...request, source, ...(source === "quote" ? { quotationId: "quote" } : {}), ...attack })
      expect(result).toEqual({
        error: "Public checkout cannot record payments or modify an existing order. Use the order payment link.",
        checkoutState: "rejected",
      })
    }
    expect(createClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(claimCheckoutMutation).not.toHaveBeenCalled()
    expectNoCheckoutEffects()
  })

  it.each(["shop", "sales"] as const)("denies forged staff privilege on %s before service-role access", async (source) => {
    const result = await checkoutCart({ ...request, source, isStaffMutation: true, existingOrderId: "victim-order",
      payments: [{ method: "cash", amount: 125 }], userId: "forged-staff" })
    expect(result).toEqual({ error: "Not authenticated" })
    expect(requirePrivateCommerceSiteAccess).toHaveBeenCalledWith(request.siteId, ["select", "insert", "update"])
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
    expectNoCheckoutEffects()
  })

  it("does not treat authenticated non-staff site access as staff mutation permission", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: "viewer", error: null })
    jest.mocked(requirePrivateCommerceSiteAccess).mockResolvedValue({ user: { id: "viewer" }, supabase: { rpc } } as never)
    expect(await checkoutCart({ ...request, isStaffMutation: true })).toEqual({ error: "Staff checkout is not authorized." })
    expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: request.siteId })
    expect(createServiceClient).not.toHaveBeenCalled()
    expectNoCheckoutEffects()
  })

  it.each(["shop", "marketplace"] as const)("uses authenticated identity and server records for %s cash instructions, not forged state", async (source) => {
    const result = await checkoutCart({ ...request, source, paymentMethod: "cash", intent: "complete",
      userId: "forged-staff", buyerUserId: "victim", sellerUserId: "forged-seller", leadId: "victim-lead",
      priceListId: "private-prices", lines: [{ catalogItemId: "product", quantity: 1, unitPriceOverride: 0 }] })
    expect(result).toEqual(confirmation)
    expect(createServiceClient).toHaveBeenCalledWith(true, { access: "public" })
    expect(prepareCheckoutEnvironment).toHaveBeenCalledWith(expect.objectContaining({
      buyerUserId: "session-buyer", userId: undefined, leadId: undefined, priceListId: undefined,
      isStaffMutation: undefined, source,
    }))
    expect(resolveCheckoutAttribution).toHaveBeenCalledWith(expect.objectContaining({ sellerUserId: undefined }))
    expect(processCheckoutLines).toHaveBeenCalledWith(expect.objectContaining({ publicCheckout: true,
      lines: [expect.not.objectContaining({ unitPriceOverride: expect.anything() })] }))
    expect(persistCheckoutRecords).toHaveBeenCalledWith(expect.objectContaining({
      publicCheckout: true, buyerUserId: "session-buyer", payments: undefined, effectiveExistingOrderId: undefined,
      paymentMethod: "cash", intent: "send", finalPriceListId: "server-prices", orderSubtotal: 125,
    }))
    expect(finalizeCheckout).toHaveBeenCalledWith(expect.objectContaining({
      sale: records.sale, order: records.order, isFullyPaid: false, orderTotal: 125,
      publicCheckout: true, clientMutationId: request.clientMutationId,
    }))
    expect(claimCheckoutMutation).toHaveBeenCalledWith(adminClient, {
      siteId: request.siteId, source, clientMutationId: request.clientMutationId, fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    const claim = jest.mocked(claimCheckoutMutation).mock.calls[0][1]
    expect(completeCheckoutMutation).toHaveBeenCalledWith(adminClient, {
      siteId: request.siteId, clientMutationId: request.clientMutationId, ownerToken: "claim-owner",
      fingerprint: claim.fingerprint, result: confirmation,
    })
    expect(persistCheckoutRecords).toHaveBeenCalledTimes(1)
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
  })

  it("takes kiosk buyer identity from the verified QR path, never the browser session or buyerUserId", async () => {
    expect(await checkoutCart({ ...kioskRequest, buyerUserId: "victim", userId: "forged-staff" })).toEqual(confirmation)
    expect(prepareSelfServiceCheckout).toHaveBeenCalledWith(expect.objectContaining({ buyerIdentityQr: kioskRequest.buyerIdentityQr }), adminClient)
    expect(prepareSelfServiceCheckout).toHaveBeenCalledWith(expect.not.objectContaining({ buyerUserId: "victim" }), adminClient)
    expect(prepareCheckoutEnvironment).toHaveBeenCalledWith(expect.objectContaining({ buyerUserId: "qr-buyer" }))
    expect(resolveCheckoutAttribution).toHaveBeenCalledWith(expect.objectContaining({ authenticatedUserId: null }))
    expect(persistCheckoutRecords).toHaveBeenCalledWith(expect.objectContaining({ buyerUserId: "qr-buyer", selfServiceLocationId: "location" }))
    expect(finalizeCheckout).toHaveBeenCalledWith(expect.objectContaining({ clientMutationId: request.clientMutationId }))
  })

  it("rejects foreign buyer-account attribution before admission or record effects", async () => {
    const actual = jest.requireActual<typeof import("@/app/buyer/verify-site-membership")>("@/app/buyer/verify-site-membership")
    jest.mocked(verifySiteMembership).mockImplementation(actual.verifySiteMembership)
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { user_id: "foreign-owner", site_members: [] }, error: null }) }
    userClient.from.mockReturnValue(query)
    userClient.rpc.mockResolvedValueOnce({ data: "collaborator", error: null })
      .mockResolvedValueOnce({ data: false, error: null })
    expect(await checkoutCart({ ...request, ownerSiteId: "foreign-account" })).toEqual({
      error: "You cannot assign this purchase to that account.", checkoutState: "rejected",
    })
    expect(verifySiteMembership).toHaveBeenCalledWith(userClient, "session-buyer", "foreign-account")
    expect(userClient.from).toHaveBeenCalledWith("sites")
    expect(query.eq).toHaveBeenCalledWith("id", "foreign-account")
    expect(userClient.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: "foreign-account" })
    expect(claimCheckoutMutation).not.toHaveBeenCalled()
    expectNoCheckoutEffects()
  })
})

describe("checkoutCart durable public retries", () => {
  it.each(["Insufficient stock", "Unable to verify prices", "Variant is unavailable"])(
    "releases a self-service claim after pre-persistence rejection (%s), allowing the next submit",
    async (message) => {
      let claimed = false
      jest.mocked(claimCheckoutMutation).mockImplementation(async () => {
        if (claimed) return { state: "processing" }
        claimed = true
        return { state: "claimed", ownerToken: "claim-owner" }
      })
      jest.mocked(releaseCheckoutMutation).mockImplementation(async () => { claimed = false })
      jest.mocked(processCheckoutLines).mockRejectedValueOnce(new Error(message))

      expect(await checkoutCart(kioskRequest)).toEqual({ error: message, checkoutState: "rejected" })
      const admission = jest.mocked(claimCheckoutMutation).mock.calls[0][1]
      expect(releaseCheckoutMutation).toHaveBeenCalledWith(adminClient, {
        siteId: request.siteId, clientMutationId: request.clientMutationId,
        ownerToken: "claim-owner", fingerprint: admission.fingerprint, recoveryLocationId: kioskRequest.selfServiceLocationId,
      })
      expect(claimed).toBe(false)
      expect(persistCheckoutRecords).not.toHaveBeenCalled()
      expect(finalizeCheckout).not.toHaveBeenCalled()
      expect(markPublicCheckoutReady).not.toHaveBeenCalled()
      expect(completeCheckoutMutation).not.toHaveBeenCalled()

      expect(await checkoutCart(kioskRequest)).toEqual(confirmation)
      expect(jest.mocked(claimCheckoutMutation).mock.calls[1][1]).toEqual(admission)
      expect(processCheckoutLines).toHaveBeenCalledTimes(2)
      expect(persistCheckoutRecords).toHaveBeenCalledTimes(1)
      expect(finalizeCheckout).toHaveBeenCalledTimes(1)
      expect(completeCheckoutMutation).toHaveBeenCalledTimes(1)
      expect(releaseCheckoutMutation).toHaveBeenCalledTimes(1)
      expect(recoverPublicCheckout).not.toHaveBeenCalled()
    },
  )

  it("keeps ordinary public line-preparation failures uncertain because reservations may already have effects", async () => {
    jest.mocked(processCheckoutLines).mockRejectedValueOnce(new Error("Reservation preparation failed"))
    expect(await checkoutCart(request)).toEqual({ error: "Reservation preparation failed", checkoutState: "uncertain" })
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
    expect(persistCheckoutRecords).not.toHaveBeenCalled()
  })

  it.each(["ready", "completed"] as const)("recovers %s before expired-QR validation, environment or writes", async (state) => {
    const stored = { state, saleId: records.sale.id, orderId: records.order.id, total: 1 }
    jest.mocked(claimCheckoutMutation).mockResolvedValue({ state, result: stored, ownerToken: "original-owner" })
    jest.mocked(prepareSelfServiceCheckout).mockRejectedValue(new Error("Invalid or expired account QR"))
    jest.mocked(prepareCheckoutEnvironment).mockRejectedValue(new Error("Environment must not be prepared during recovery"))
    expect(await checkoutCart(kioskRequest)).toEqual(confirmation)
    const { fingerprint } = jest.mocked(claimCheckoutMutation).mock.calls[0][1]
    if (state === "ready") {
      expect(recoverPublicCheckout).toHaveBeenCalledWith(adminClient, request.siteId, stored, {
        siteId: request.siteId, clientMutationId: request.clientMutationId, ownerToken: "original-owner", fingerprint,
        recoveryLocationId: kioskRequest.selfServiceLocationId,
      })
    } else {
      expect(recoverPublicCheckout).toHaveBeenCalledWith(adminClient, request.siteId, stored)
    }
    expectNoCheckoutEffects()
    expect(completeCheckoutMutation).not.toHaveBeenCalled()
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
    expect(jest.mocked(claimCheckoutMutation).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(recoverPublicCheckout).mock.invocationCallOrder[0])
  })

  it("retains ready state after token failure and recovers the same attempt with exactly one persistence", async () => {
    let ready: Record<string, unknown> | undefined
    jest.mocked(claimCheckoutMutation).mockImplementation(async () => ready
      ? { state: "ready", result: ready, ownerToken: "claim-owner" }
      : { state: "claimed", ownerToken: "claim-owner" })
    jest.mocked(markPublicCheckoutReady).mockImplementation(async (_client, claim, persisted) => {
      ready = { state: "ready", ...claim, saleId: persisted.sale.id, orderId: persisted.order.id }
    })
    jest.mocked(finalizeCheckout).mockImplementationOnce(async (params) => {
      expect(params.sale).toBe(records.sale)
      expect(params.order).toBe(records.order)
      expect(params.clientMutationId).toBe(request.clientMutationId)
      expect(params.onReadyForPublicToken).toEqual(expect.any(Function))
      await params.onReadyForPublicToken!()
      throw new Error("Failed to create public order link")
    })
    expect(await checkoutCart(kioskRequest)).toEqual({ error: "Failed to create public order link", checkoutState: "uncertain" })
    const { fingerprint } = jest.mocked(claimCheckoutMutation).mock.calls[0][1]
    const identity = { siteId: request.siteId, clientMutationId: request.clientMutationId, ownerToken: "claim-owner", fingerprint,
      recoveryLocationId: kioskRequest.selfServiceLocationId }
    expect(markPublicCheckoutReady).toHaveBeenCalledWith(adminClient, identity, records)
    expect(ready).toEqual({ state: "ready", ...identity, saleId: records.sale.id, orderId: records.order.id })
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
    expect(completeCheckoutMutation).not.toHaveBeenCalled()

    // The original QR can expire after the order was durably written.
    jest.mocked(prepareSelfServiceCheckout).mockRejectedValue(new Error("Invalid or expired account QR"))
    userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "different-kiosk-session" } }, error: null })
    expect(await checkoutCart(kioskRequest)).toEqual(confirmation)
    expect(recoverPublicCheckout).toHaveBeenCalledWith(adminClient, request.siteId, ready, identity)
    expect(jest.mocked(claimCheckoutMutation).mock.calls[1][1]).toEqual(jest.mocked(claimCheckoutMutation).mock.calls[0][1])
    for (const effect of [prepareSelfServiceCheckout, prepareCheckoutEnvironment, processCheckoutLines,
      persistCheckoutRecords, finalizeCheckout, markPublicCheckoutReady]) expect(effect).toHaveBeenCalledTimes(1)
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
  })

  it("requires the caller's stable mutation identity before preparing any public checkout effects", async () => {
    expect(await checkoutCart({ ...request, clientMutationId: undefined })).toEqual({
      error: "An idempotency key is required", checkoutState: "rejected",
    })
    expect(claimCheckoutMutation).not.toHaveBeenCalled()
    expectNoCheckoutEffects()
  })

  it("passes a changed fingerprint to admission for a changed cart or authenticated buyer using the same key", async () => {
    let originalFingerprint: string | undefined
    jest.mocked(claimCheckoutMutation).mockImplementation(async (_client, claim) => {
      if (!originalFingerprint) originalFingerprint = claim.fingerprint
      return claim.fingerprint === originalFingerprint
        ? { state: "completed", result: confirmation }
        : { state: "error", error: "This checkout attempt belongs to a different request." }
    })
    expect(await checkoutCart(request)).toEqual(confirmation)
    const rejection = { error: "This checkout attempt belongs to a different request.", checkoutState: "uncertain" }
    expect(await checkoutCart({ ...request, lines: [{ catalogItemId: "product", quantity: 2 }] })).toEqual(rejection)
    userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "different-buyer" } }, error: null })
    expect(await checkoutCart(request)).toEqual(rejection)
    const claims = jest.mocked(claimCheckoutMutation).mock.calls.map(([, claim]) => claim)
    expect(claims.every((claim) => claim.clientMutationId === request.clientMutationId)).toBe(true)
    expect(new Set(claims.map((claim) => claim.fingerprint)).size).toBe(3)
    expect(recoverPublicCheckout).toHaveBeenCalledTimes(1)
    expectNoCheckoutEffects()
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
  })

  it.each([
    { state: "processing" as const },
    { state: "error" as const, error: "This checkout attempt belongs to a different request. Review the original order before retrying." },
  ])("does not replay or release records when admission returns $state", async (claim) => {
    jest.mocked(claimCheckoutMutation).mockResolvedValue(claim)
    const result = await checkoutCart(kioskRequest)
    expect(result).toEqual({ checkoutState: "uncertain", error: claim.state === "error" ? claim.error
      : "This checkout is being processed or requires staff review. Retry this same attempt; do not place another order." })
    expect(claimCheckoutMutation).toHaveBeenCalledWith(adminClient, expect.objectContaining({
      siteId: request.siteId, clientMutationId: request.clientMutationId, fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expectNoCheckoutEffects()
    expect(recoverPublicCheckout).not.toHaveBeenCalled()
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
    expect(completeCheckoutMutation).not.toHaveBeenCalled()
  })

  it("keeps recovery failure uncertain and never falls through into a fresh checkout", async () => {
    jest.mocked(claimCheckoutMutation).mockResolvedValue({ state: "completed", result: confirmation })
    jest.mocked(recoverPublicCheckout).mockRejectedValue(new Error("The order link is no longer available. Ask staff for assistance."))
    expect(await checkoutCart(request)).toEqual({
      error: "The order link is no longer available. Ask staff for assistance.", checkoutState: "uncertain",
    })
    expectNoCheckoutEffects()
    expect(releaseCheckoutMutation).not.toHaveBeenCalled()
  })
})