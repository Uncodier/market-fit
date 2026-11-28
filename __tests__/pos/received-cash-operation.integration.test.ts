/** @jest-environment node */
import { executePosOperation } from "@/app/pos/operation-boundary";
import { posOrderVersion } from "@/app/pos/order-version";
import { checkoutCart } from "@/app/commerce/checkout";
import { finalizeCheckout } from "@/app/commerce/checkout-finalize";
import { prepareCheckoutEnvironment } from "@/app/commerce/checkout-environment";
import { processCheckoutLines } from "@/app/commerce/checkout-lines";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { createServiceClient } from "@/lib/supabase/server";
import { siteId, orderId, userId, locationId, sessionId, requestId, register } from "./operation-fixtures";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/app/pos/actions/get-order", () => ({ getPosOrder: jest.fn() }));
jest.mock("@/app/commerce/checkout-environment", () => ({ prepareCheckoutEnvironment: jest.fn() }));
jest.mock("@/app/commerce/checkout-attribution", () => ({ resolveCheckoutAttribution: jest.fn(async () => ({})) }));
jest.mock("@/app/commerce/checkout-lines", () => ({ processCheckoutLines: jest.fn() }));
jest.mock("@/app/commerce/checkout-finalize", () => ({ finalizeCheckout: jest.fn() }));

const saleId = "80000000-0000-4000-8000-000000000001";
const paymentId = "80000000-0000-4000-8000-000000000002";
const promotionId = "80000000-0000-4000-8000-000000000003";
const catalogItemId = "80000000-0000-4000-8000-000000000004";
const storedLine = { id: "80000000-0000-4000-8000-000000000005", catalog_item_id: catalogItemId,
  status: "pending", parent_sale_order_item_id: null, quantity: 1, unit_price: 10, metadata: { client_line_key: "original" } };
const sale = { id: saleId, source: "shop", status: "pending", amount: 8, amount_due: 8, payments: [] };
const order = { id: orderId, site_id: siteId, sale_id: saleId, status: "pending", currency: "USD", subtotal: 10,
  tax_total: 0, shipping_cost: 0, total: 8, promotion_id: promotionId, discount_total: 2, fulfillment_method: "pickup",
  notes: null, updated_at: "2026-10-23T10:00:00Z", origin_location_id: null, sales: sale, sale_order_items: [storedLine], items: [] };
// The cashier added a second unit before taking cash. The fingerprint and tender cover the edited cart,
// but the order-version guard must still compare against the unpaid, single-unit Shop order.
const original = { siteId, source: "pos" as const, existingOrderId: orderId, expectedOrderVersion: posOrderVersion(order),
  intent: "pay" as const, fulfillment: "pickup" as const, promotionId, originLocationId: locationId,
  clientMutationId: requestId, registerSessionId: sessionId, lines: [{ catalogItemId, quantity: 2, clientLineKey: "original" }],
  payments: [{ paymentId, method: "cash" as const, amount: 18, tendered: 20, change: 2 }] };
// An absent userId on original admission and the explicit same cashier on recovery
// normalize to the same server-owned actor before fingerprinting.
const manual = { ...original, userId, recoverReceivedCash: true };
const completed = { success: true as const, orderId, saleId };
const dispatch = (input: unknown) => executePosOperation({ operation: "checkout", input });
const rpc = jest.fn();
const directWrite = jest.fn(() => { throw new Error("Unexpected non-atomic write"); });
let attempt: Record<string, unknown> | null;
let receipts: Record<string, unknown>[];

// The read fixture feeds the real payment evidence, register, order-version,
// recorded-promotion and record-persistence paths. No network or database connection is opened.
function from(table: string) {
  const rows: Record<string, unknown> = { pos_checkout_attempts: attempt, pos_client_mutations: null,
    pos_register_sessions: register, sale_orders: order, sales: sale, sale_order_items: [storedLine] };
  const response = (data: unknown) => Promise.resolve({ data, error: null });
  let bySale = false;
  const query = {
    select: () => query, eq: (key: string, value: unknown) => { if (key === "sale_id" && value === saleId) bySale = true; return query; },
    in: (_key: string, ids: string[]) => response(table === "pos_register_receipts" ? receipts : ids.map(id => ({ id }))),
    single: () => response(rows[table]), maybeSingle: () => response(rows[table]),
    then: <T>(resolve: (value: { data: unknown; error: null }) => T) =>
      response(table === "sale_orders" && bySale ? [{ id: orderId }] : rows[table]).then(resolve),
    insert: directWrite, update: directWrite, upsert: directWrite,
  };
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  attempt = null;
  receipts = [];
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ user: { id: userId }, role: "collaborator",
    supabase: { from, rpc: async () => ({ data: "collaborator", error: null }) } } as never);
  jest.mocked(createServiceClient).mockResolvedValue({ from, rpc } as never);
  jest.mocked(getPosOrder).mockResolvedValue({ data: order } as never);
  jest.mocked(prepareCheckoutEnvironment).mockResolvedValue({ finalOriginLocationId: locationId } as never);
  jest.mocked(processCheckoutLines).mockResolvedValue({ orderSubtotal: 20, orderTaxTotal: 0, orderShippingCost: 0,
    orderCurrency: "USD", processedLines: [{ ...storedLine, quantity: 2, subtotal: 20, name: "Tea", currency: "USD",
      client_line_key: "original", parent_client_line_key: null }] } as never);
  jest.mocked(finalizeCheckout).mockResolvedValue({ ...completed, quotationCompleted: false } as never);
  rpc.mockImplementation(async (name) => {
    if (name === "pos_checkout_claim") return { data: { state: "claimed" }, error: null };
    if (name === "pos_checkout_recover_cash") return { data: { order: { ...order, total: 18 }, sale: { ...sale, amount_due: 0 } }, error: null };
    if (name === "pos_checkout_transition") return { data: true, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });
});

async function failedOriginal() {
  // Capture the historical fingerprint from ordinary admission, not from the recovery hash helper.
  jest.mocked(processCheckoutLines).mockRejectedValueOnce(new Error("Original preparation failed"));
  expect((await dispatch(original)).body).toHaveProperty("error");
  expect(rpc.mock.calls.map(([name, args]) => args.p_state ?? name)).toEqual([
    "pos_checkout_claim", "writes_started", "review_required",
  ]);
  const { p_fingerprint, p_actor_id } = rpc.mock.calls[0][1];
  attempt = { actor_id: p_actor_id, fingerprint: p_fingerprint, order_id: orderId, sale_id: null, state: "review_required" };
  jest.clearAllMocks();
  return p_fingerprint;
}

it("recovers the original normalized checkout via the cash RPC, then returns its saved result without replay", async () => {
  const fingerprint = await failedOriginal();
  // Ordinary/background retries of the exact same payload cannot opt themselves into cash recovery.
  await expect(dispatch(original)).resolves.toMatchObject({ status: 409, body: { recovery: { state: "review_required" } } });
  expect(rpc).not.toHaveBeenCalled();
  expect(processCheckoutLines).not.toHaveBeenCalled();

  await expect(dispatch(manual)).resolves.toEqual({ status: 200, body: completed });
  const [[name, commit], [transition, finish]] = rpc.mock.calls;
  expect([name, transition]).toEqual(["pos_checkout_recover_cash", "pos_checkout_transition"]);
  expect(commit).toMatchObject({ p_actor_id: userId, p_mutation_id: requestId, p_site_id: siteId, p_order_id: orderId,
    p_payment_id: paymentId, p_fingerprint: fingerprint, p_baseline: JSON.parse(original.expectedOrderVersion),
    p_order_patch: { promotion_id: promotionId, discount_total: 2, total: 18 },
    p_sale_patch: { source: "shop", amount_due: 0, payments: [{ payment_id: paymentId, method: "cash", amount: 18,
      tendered: 20, change: 2, recorded_by: userId, register_session_id: sessionId }] } });
  expect(finish).toMatchObject({ p_owner_token: commit.p_owner_token, p_state: "completed", p_result: completed });
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(finalizeCheckout).mock.invocationCallOrder[0]);
  expect(jest.mocked(finalizeCheckout).mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);

  attempt = { ...attempt, state: "completed", result: finish.p_result, sale_id: saleId };
  await expect(dispatch(manual)).resolves.toEqual({ status: 200, body: { ...completed, idempotent: true } });
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(processCheckoutLines).toHaveBeenCalledTimes(1);
  expect(finalizeCheckout).toHaveBeenCalledTimes(1);
  expect(directWrite).not.toHaveBeenCalled();
});

it("denies forged flags, direct Server Action calls and modified or unadmitted attempts before replay", async () => {
  await expect(dispatch({ ...manual, recoverReceivedCash: "true" })).resolves.toMatchObject({ status: 400 });
  await expect(checkoutCart(manual)).resolves.toMatchObject({ recovery: { state: "review_required" } });
  expect(createServiceClient).not.toHaveBeenCalled();
  const denied = { status: 409, body: { recovery: { state: "review_required" } } };
  await expect(dispatch(manual)).resolves.toMatchObject(denied);
  expect(rpc).not.toHaveBeenCalled();
  await failedOriginal();
  await expect(dispatch({ ...manual, payments: [{ ...manual.payments[0], paymentId: orderId }] })).resolves.toMatchObject(denied);
  expect(rpc).not.toHaveBeenCalled();
  expect(prepareCheckoutEnvironment).not.toHaveBeenCalled();
  expect(finalizeCheckout).not.toHaveBeenCalled();
  expect(directWrite).not.toHaveBeenCalled();
});

it("keeps a refused atomic recovery in review instead of falling back to ordinary payment or finalization", async () => {
  await failedOriginal();
  rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
  await expect(dispatch(manual)).resolves.toMatchObject({ status: 409, body: { recovery: { state: "review_required" } } });
  expect(rpc.mock.calls[0][0]).toBe("pos_checkout_recover_cash");
  // Cleanup may attempt to retain review under the fresh token; it cannot admit a new attempt.
  for (const [name, args] of rpc.mock.calls.slice(1)) {
    expect([name, args.p_state, args.p_owner_token]).toEqual([
      "pos_checkout_transition", "review_required", rpc.mock.calls[0][1].p_owner_token,
    ]);
  }
  expect(finalizeCheckout).not.toHaveBeenCalled();
  expect(directWrite).not.toHaveBeenCalled();
});

it("does not finalize again when the original receipt is already recorded but no complete result exists", async () => {
  await failedOriginal();
  receipts = [{ id: paymentId, actor_id: userId, session_id: sessionId, sale_id: saleId,
    method: "cash", amount: 18, tendered: 20, change: 2 }];
  await expect(dispatch(manual)).resolves.toMatchObject({ status: 409, body: { recovery: { state: "payment_recorded", orderId, saleId } } });
  expect(rpc).not.toHaveBeenCalled();
  expect(prepareCheckoutEnvironment).not.toHaveBeenCalled();
  expect(finalizeCheckout).not.toHaveBeenCalled();
  expect(directWrite).not.toHaveBeenCalled();
});