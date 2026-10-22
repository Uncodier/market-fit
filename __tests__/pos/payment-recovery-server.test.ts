/** @jest-environment node */
import { inspectPosPayment, type PaymentRecoveryRequest } from "@/app/pos/payment-recovery-server";
import { reconcilePosCheckoutStatus } from "@/app/pos/actions/reconcile-checkout";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { createServiceClient } from "@/lib/supabase/server";

jest.mock("server-only", () => ({}));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }));
const siteId = "11111111-1111-4111-8111-111111111111";
const paymentId = "22222222-2222-4222-8222-222222222222";
const request: PaymentRecoveryRequest = { siteId, clientMutationId: "original", existingOrderId: "33333333-3333-4333-8333-333333333333",
  registerSessionId: "44444444-4444-4444-8444-444444444444",
  payments: [{ paymentId, amount: 100, method: "cash", tendered: 120, change: 20 }],
};
type Read = { data: unknown; error?: unknown };
let reads: Record<string, Read>;
const from = jest.fn((table: string) => {
  const q = { select: jest.fn(() => q), eq: jest.fn(() => q), in: jest.fn(() => q),
    maybeSingle: jest.fn(async () => reads[table]),
    then: (resolve: (value: Read) => unknown) => Promise.resolve(reads[table]).then(resolve),
  };
  return q;
});
const receipt = { id: paymentId, site_id: siteId, actor_id: "cashier", session_id: request.registerSessionId,
  sale_id: "sale", method: "cash", amount: "100", tendered: "120", change: "20" };
const mutation = { kind: "checkout", sale_id: "sale", order_id: request.existingOrderId, result: { success: true, kitchenDelta: null } };

describe("POS read-only payment reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reads = { pos_checkout_attempts: { data: null }, pos_client_mutations: { data: null },
      pos_register_receipts: { data: [] }, sale_orders: { data: [{ id: request.existingOrderId }] } };
    jest.mocked(createServiceClient).mockResolvedValue({ from } as never);
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ user: { id: "cashier" }, role: "collaborator", supabase: {} } as never);
  });
  it("recovers a completed checkout, even after its shift or order is closed", async () => {
    reads.pos_client_mutations.data = mutation;
    reads.pos_register_receipts.data = [receipt];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({
      state: "completed", result: { success: true, orderId: request.existingOrderId, saleId: "sale" },
    });
    expect(from).not.toHaveBeenCalledWith("pos_register_sessions");
  });
  it("recognizes committed money without inventing a completed checkout", async () => {
    reads.pos_register_receipts.data = [receipt];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "payment_recorded",
      saleId: "sale", orderId: request.existingOrderId });
    expect(from.mock.results.every((r) => !r.value.update && !r.value.insert && !r.value.delete)).toBe(true);
  });
  it("only definitive pre-write rejection is safe to retire", async () => {
    reads.pos_checkout_attempts.data = { actor_id: "cashier", state: "rejected" };
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "rejected" });
    reads.pos_checkout_attempts.data = null;
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "not_found" });
  });
  it("does not classify a running request as rejected, nor overwrite finalization uncertainty", async () => {
    reads.pos_checkout_attempts.data = { actor_id: "cashier", state: "writes_started" };
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "processing" });
    reads.pos_register_receipts.data = [receipt];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "payment_recorded" });
    reads.pos_checkout_attempts.data = { actor_id: "cashier", state: "review_required" };
    reads.pos_client_mutations.data = mutation;
    reads.pos_register_receipts.data = [];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "review_required" });
  });
  it.each(["actor_id", "session_id", "amount", "method", "tendered", "change"])("rejects mismatched receipt %s", async (key) => {
    reads.pos_register_receipts.data = [{ ...receipt, [key]: "wrong" }];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "not_found" });
  });
  it("does not assign a receipt to a different order or accept partial receipts", async () => {
    reads.pos_register_receipts.data = [receipt];
    reads.sale_orders.data = [{ id: "foreign-order" }];
    await expect(inspectPosPayment({ from }, request, "cashier")).resolves.toMatchObject({ state: "not_found" });
    await expect(inspectPosPayment({ from }, { ...request, payments: [...request.payments, { ...request.payments[0], paymentId: "another" }] }, "cashier"))
      .resolves.toMatchObject({ state: "not_found" });
  });
  it.each(["pos_checkout_attempts", "pos_client_mutations", "pos_register_receipts", "sale_orders"])("fails closed on %s read errors", async (table) => {
    reads.pos_register_receipts.data = [receipt]; reads[table].error = { message: "unavailable" };
    await expect(inspectPosPayment({ from }, request, "cashier")).rejects.toThrow("Unable");
  });
  it("denies a different actor's attempt", async () => {
    reads.pos_checkout_attempts.data = { actor_id: "foreign", state: "completed", result: { success: true } };
    await expect(inspectPosPayment({ from }, request, "cashier")).rejects.toThrow("another cashier");
  });
  it("validates and authorizes the Server Action before privileged reads", async () => {
    await expect(reconcilePosCheckoutStatus({ ...request, siteId: "invalid" })).resolves.toHaveProperty("error");
    expect(createServiceClient).not.toHaveBeenCalled();
    for (const role of ["marketing", "", "foreign"]) {
      jest.mocked(requirePosSiteAccess).mockResolvedValue({ user: { id: "cashier" }, role, supabase: {} } as never);
      await expect(reconcilePosCheckoutStatus(request)).resolves.toHaveProperty("error");
    }
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Not authenticated" });
    await expect(reconcilePosCheckoutStatus(request)).resolves.toHaveProperty("error");
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  it("uses scoped read-only evidence and returns no raw provider errors", async () => {
    reads.pos_register_receipts.data = [receipt];
    await expect(reconcilePosCheckoutStatus(request)).resolves.toMatchObject({ data: { state: "payment_recorded" } });
    expect(createServiceClient).toHaveBeenCalledWith(true, { access: "workspace" });
    reads.pos_register_receipts.error = { message: "secret backend details" };
    const failed = await reconcilePosCheckoutStatus(request);
    expect(JSON.stringify(failed)).not.toContain("secret");
    expect(failed).toHaveProperty("error");
  });
});