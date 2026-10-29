/** @jest-environment node */
import { checkoutCart } from "@/app/commerce/checkout";
import { claimPosCheckout, transitionPosCheckout } from "@/app/pos/checkout-attempt-server";
import { inspectPosPayment } from "@/app/pos/payment-recovery-server";
import { findPosClientMutation } from "@/app/pos/actions/idempotency";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { assertRegisterCheckout } from "@/app/pos/register/checkout-guard";
import { assertPosOrderCurrent } from "@/app/pos/assert-order-current";
import { prepareCheckoutEnvironment } from "@/app/commerce/checkout-environment";
import { processCheckoutLines } from "@/app/commerce/checkout-lines";
import { persistCheckoutRecords } from "@/app/commerce/checkout-records";
import { finalizeCheckout } from "@/app/commerce/checkout-finalize";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requirePosCheckoutAccess, withPosCheckoutAccessScope } from "@/app/pos/checkout-request-access";
import { withPosServerTiming } from "@/app/pos/checkout-server-timing";
import type { CheckoutCartParams } from "@/app/commerce/checkout-types";
import { PosCheckoutRecoveryError } from "@/app/pos/checkout-recovery-types";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "cashier" } } }) },
})), createServiceClient: jest.fn(async () => ({})) }));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/app/pos/checkout-attempt-server", () => ({ claimPosCheckout: jest.fn(), transitionPosCheckout: jest.fn(), posCheckoutFingerprint: jest.fn(() => "fingerprint") }));
jest.mock("@/app/pos/payment-recovery-server", () => ({ inspectPosPayment: jest.fn() }));
jest.mock("@/app/pos/actions/idempotency", () => ({ findPosClientMutation: jest.fn() }));
jest.mock("@/app/pos/register/checkout-guard", () => ({ assertRegisterCheckout: jest.fn() }));
jest.mock("@/app/pos/assert-order-current", () => ({ assertPosOrderCurrent: jest.fn() }));
jest.mock("@/app/commerce/checkout-environment", () => ({ prepareCheckoutEnvironment: jest.fn() }));
jest.mock("@/app/commerce/checkout-attribution", () => ({ resolveCheckoutAttribution: jest.fn(async () => ({})) }));
jest.mock("@/app/commerce/checkout-lines", () => ({ processCheckoutLines: jest.fn() }));
jest.mock("@/app/commerce/checkout-records", () => ({ persistCheckoutRecords: jest.fn() }));
jest.mock("@/app/commerce/checkout-finalize", () => ({ finalizeCheckout: jest.fn() }));
jest.mock("@/app/commerce/checkout-idempotency", () => ({}));
jest.mock("@/app/quotations/quote-checkout", () => ({}));
jest.mock("@/app/documents/public-token-store", () => ({}));
const claim = { siteId: "site", mutationId: "attempt", ownerToken: "owner" };
const payload: CheckoutCartParams = { siteId: "site", clientMutationId: "attempt", source: "pos", userId: "cashier",
  existingOrderId: "order", expectedOrderVersion: "baseline", fulfillment: "pickup", intent: "pay", lines: [{ catalogItemId: "sku", quantity: 1 }],
  registerSessionId: "session", payments: [{ paymentId: "receipt", method: "cash", amount: 100 }],
};
const completed = { success: true as const, saleId: "sale", orderId: "order", publicAccessToken: "token", orderNumber: "ORD-100" };

describe("POS durable checkout admission and evidence ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ user: { id: "cashier" }, role: "collaborator", supabase: {} } as never);
    jest.mocked(findPosClientMutation).mockResolvedValue({ data: null });
    jest.mocked(inspectPosPayment).mockResolvedValue({ state: "not_found", message: "Unknown" });
    jest.mocked(claimPosCheckout).mockResolvedValue({ claim });
    jest.mocked(transitionPosCheckout).mockResolvedValue(undefined);
    jest.mocked(assertRegisterCheckout).mockResolvedValue(undefined);
    jest.mocked(assertPosOrderCurrent).mockResolvedValue(undefined);
    jest.mocked(prepareCheckoutEnvironment).mockResolvedValue({} as never);
    jest.mocked(processCheckoutLines).mockResolvedValue({ processedLines: [] } as never);
    jest.mocked(persistCheckoutRecords).mockResolvedValue({ sale: { id: "sale" }, order: { id: "order" } } as never);
    jest.mocked(finalizeCheckout).mockResolvedValue({ ...completed, quotationCompleted: false } as never);
  });
  it("recovers a committed result before checking stale balances or a closed register", async () => {
    jest.mocked(inspectPosPayment).mockResolvedValue({ state: "completed", message: "Recovered", result: completed });
    await expect(checkoutCart(payload)).resolves.toMatchObject({ success: true, idempotent: true, orderNumber: "ORD-100" });
    expect(assertPosOrderCurrent).not.toHaveBeenCalled(); expect(assertRegisterCheckout).not.toHaveBeenCalled();
    expect(claimPosCheckout).not.toHaveBeenCalled(); expect(persistCheckoutRecords).not.toHaveBeenCalled();
  });
  it("does not replay legacy committed money without checkout completion", async () => {
    jest.mocked(inspectPosPayment).mockResolvedValue({ state: "payment_recorded", message: "Do not recollect", saleId: "sale", orderId: "order" });
    await expect(checkoutCart(payload)).resolves.toMatchObject({ recovery: { state: "payment_recorded" } });
    expect(processCheckoutLines).not.toHaveBeenCalled(); expect(claimPosCheckout).not.toHaveBeenCalled();
  });
  it("fails closed on a result lookup error rather than executing checkout", async () => {
    jest.mocked(inspectPosPayment).mockRejectedValue(new Error("Unable to read"));
    await expect(checkoutCart(payload)).resolves.toMatchObject({ error: "Unable to read" });
    expect(claimPosCheckout).not.toHaveBeenCalled(); expect(persistCheckoutRecords).not.toHaveBeenCalled();
  });
  it("reuses only server-authorized client/identity and times all awaited checkout stages", async () => {
    const measured = await withPosServerTiming(() => withPosCheckoutAccessScope(async () => {
      const access = await requirePosCheckoutAccess(payload.siteId);
      const result = await checkoutCart({ ...payload, userId: "forged-client-user" });
      expect(prepareCheckoutEnvironment).toHaveBeenCalledWith(expect.objectContaining({ supabase: access.supabase, userId: "cashier" }));
      return result;
    }));
    expect(measured.value).toMatchObject({ success: true });
    expect(requirePosSiteAccess).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
    for (const stage of ["auth", "admission", "environment", "attribution", "lines", "records", "finalize", "complete"]) {
      expect(measured.serverTiming).toContain(`checkout_${stage};dur=`);
    }
    expect(measured.serverTiming).not.toMatch(/cashier|token|receipt|forged/);
    await checkoutCart(payload);
    expect(requirePosSiteAccess).toHaveBeenCalledTimes(2);
  });
  it("ignores browser-supplied authorization flags on direct action calls", async () => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Forbidden" });
    const forged = { ...payload, authorized: true, posAccess: { user: { id: "cashier" }, role: "owner" } };
    expect(await checkoutCart(forged)).toEqual({ error: "Forbidden" });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(persistCheckoutRecords).not.toHaveBeenCalled();
  });
  it("persists admission and a write boundary before applying checkout", async () => {
    await expect(checkoutCart(payload)).resolves.toMatchObject({ success: true });
    expect(transitionPosCheckout).toHaveBeenNthCalledWith(1, expect.anything(), claim, "writes_started");
    expect(transitionPosCheckout).toHaveBeenNthCalledWith(2, expect.anything(), claim, "completed", completed);
    expect(jest.mocked(transitionPosCheckout).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(processCheckoutLines).mock.invocationCallOrder[0]);
    expect(persistCheckoutRecords).toHaveBeenCalledWith(expect.objectContaining({ posClaim: claim }));
  });
  it("records a stale pre-write attempt as rejected", async () => {
    jest.mocked(assertPosOrderCurrent).mockRejectedValueOnce(new Error("Order changed"));
    await expect(checkoutCart(payload)).resolves.toMatchObject({ error: "Order changed" });
    expect(transitionPosCheckout).toHaveBeenCalledWith(expect.anything(), claim, "rejected");
    expect(processCheckoutLines).not.toHaveBeenCalled();
  });
  it("checks durable fingerprint admission for device-stamped unpaid operations instead of the legacy shortcut", async () => {
    const identified = { ...payload, payments: [], posOperationIdentity: {
      version: 1 as const, deviceId: "22222222-2222-4222-8222-222222222222", createdAt: "2026-10-28T12:00:00.000Z",
    } };
    await checkoutCart(identified);
    expect(findPosClientMutation).not.toHaveBeenCalled();
    expect(claimPosCheckout).toHaveBeenCalledWith(expect.anything(), identified, "cashier");
  });
  it.each(["processing", "review_required", "rejected"] as const)("returns %s without repeating writes for unpaid admission retries", async (state) => {
    jest.mocked(claimPosCheckout).mockRejectedValueOnce(new PosCheckoutRecoveryError({ state, message: "Original attempt" }));
    const identified = { ...payload, payments: [], posOperationIdentity: {
      version: 1 as const, deviceId: "22222222-2222-4222-8222-222222222222", createdAt: "2026-10-28T12:00:00.000Z",
    } };
    await expect(checkoutCart(identified)).resolves.toMatchObject({ recovery: { state } });
    expect(prepareCheckoutEnvironment).not.toHaveBeenCalled();
    expect(processCheckoutLines).not.toHaveBeenCalled();
    expect(persistCheckoutRecords).not.toHaveBeenCalled();
    expect(finalizeCheckout).not.toHaveBeenCalled();
  });
  it("never claims a post-write failure was unapplied", async () => {
    jest.mocked(finalizeCheckout).mockRejectedValueOnce(new Error("Finalization interrupted"));
    await expect(checkoutCart(payload)).resolves.toMatchObject({ error: "Finalization interrupted" });
    expect(transitionPosCheckout).toHaveBeenLastCalledWith(expect.anything(), claim, "review_required");
    expect(transitionPosCheckout).not.toHaveBeenCalledWith(expect.anything(), claim, "rejected");
  });
  it("does not hide a lost outcome write, nor retry a completed payment", async () => {
    jest.mocked(transitionPosCheckout).mockRejectedValueOnce(new Error("Admission write failed"));
    await expect(checkoutCart(payload)).resolves.toHaveProperty("error");
    expect(persistCheckoutRecords).not.toHaveBeenCalled();
  });
  it("denies unauthenticated, restricted or forbidden actors before privileged admission", async () => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Not authenticated" });
    await expect(checkoutCart(payload)).resolves.toHaveProperty("error");
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ role: "marketing", user: { id: "cashier" }, supabase: {} } as never);
    await expect(checkoutCart(payload)).resolves.toHaveProperty("error");
    expect(createServiceClient).not.toHaveBeenCalled(); expect(claimPosCheckout).not.toHaveBeenCalled();
  });
});