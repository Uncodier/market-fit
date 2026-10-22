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
import { createServiceClient } from "@/lib/supabase/server";
import type { CheckoutCartParams } from "@/app/commerce/checkout-types";

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