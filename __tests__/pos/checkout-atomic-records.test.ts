/** @jest-environment node */
import { persistCheckoutRecords } from "@/app/commerce/checkout-records";
import type { ProcessedCheckoutLine } from "@/app/commerce/checkout-types";

jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }));
const order = { id: "order", sale_id: "sale", status: "completed", total: 100, currency: "USD", notes: null, updated_at: "2026-10-22T12:00:00Z" };
const sale = { id: "sale", amount: 100, amount_due: 100, payments: [], status: "pending" };
const update = jest.fn();
type Read = { data: unknown; error: null };
type Query = PromiseLike<Read> & { select: jest.Mock; eq: jest.Mock; single: jest.Mock; update: jest.Mock };
const from = jest.fn((table: string): Query => {
  const read: Read = { data: table === "sale_orders" ? order : table === "sales" ? sale : [], error: null };
  const query: Query = { select: jest.fn((): Query => query), eq: jest.fn((): Query => query),
    single: jest.fn(async () => read), update,
    then: (...args) => Promise.resolve(read).then(...args),
  };
  return query;
});
const rpc = jest.fn();
const line: ProcessedCheckoutLine = { site_id: "site", catalog_item_id: "sku", name: "Product", currency: "USD",
  quantity: 1, unit_price: 100, subtotal: 100, client_line_key: "line", parent_client_line_key: null,
  modifier_group_id: null, parent_name: null, is_reservation_dropin: false, isRoundRobinDropin: false };
const params: Parameters<typeof persistCheckoutRecords>[0] = {
  supabase: { from }, supabaseAdmin: { from, rpc }, isAdmin: false, siteId: "site", source: "pos",
  fulfillment: "pickup", processedLines: [line], quoteForAccept: null, orderSubtotal: 100,
  orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD", effectiveExistingOrderId: "order",
  payments: [{ method: "cash", amount: 50, paymentId: "receipt" }], registerSessionId: "session", registerActorId: "cashier",
  posClaim: { siteId: "site", mutationId: "attempt", ownerToken: "owner" }, intent: "pay",
};
describe("POS existing-order atomic record writer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: { sale: { ...sale, amount_due: 50 }, order }, error: null });
  });
  it("uses one authorized RPC with expected balance/payment/order snapshots, never separate updates", async () => {
    const result = await persistCheckoutRecords(params);
    expect(rpc).toHaveBeenCalledWith("pos_checkout_commit_order", expect.objectContaining({
      p_site_id: "site", p_mutation_id: "attempt", p_owner_token: "owner", p_order_id: "order",
      p_expected_sale: { amount: 100, amount_due: 100, payments: [] }, p_expected_order: order,
      p_sale_patch: expect.objectContaining({ amount_due: 50, payments: [expect.objectContaining({
        payment_id: "receipt", register_session_id: "session", recorded_by: "cashier", amount: 50,
      })] }),
      p_order_patch: expect.objectContaining({ status: "completed" }),
    }));
    expect(result.sale.amount_due).toBe(50);
    expect(result.orderInitialStatus).toBe("completed");
    expect(update).not.toHaveBeenCalled();
  });
  it("fails closed if atomic commit fails, without falling back to unsafe updates", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
    await expect(persistCheckoutRecords(params)).rejects.toThrow("could not be committed");
    expect(update).not.toHaveBeenCalled();
  });
});