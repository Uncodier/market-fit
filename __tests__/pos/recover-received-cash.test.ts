import { canReviewReceivedCash, recoverReceivedCash } from "@/app/pos/local/recover-received-cash";
import { posOrderVersion } from "@/app/pos/order-version";
import type { PosOrderSnapshot } from "@/app/pos/order-snapshot";
import type { PosOutboxRow } from "@/app/pos/local/types";
import { getPosDb } from "@/app/pos/local/db";
import { reconcilePosCheckout, applyPosCheckoutRecovery } from "@/app/pos/local/checkout-recovery";
import { checkoutPosCart, fetchPosOrder } from "@/app/pos/operation-client";
import { refreshPosSyncCounts } from "@/app/pos/local/sync-engine";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/remote-permission", () => ({
  assertPosRemotePermission: jest.fn(), requirePosRemotePermission: () => ({ userId: "cashier" }),
}));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn(), applyPosCheckoutRecovery: jest.fn() }));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn(), checkoutPosCart: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ refreshPosSyncCounts: jest.fn() }));

const order = { site_id: "site", id: "order", sale_id: "sale", status: "pending", currency: "MXN", promotion_id: "promo",
  total: 208, discount_total: 52, sales: { source: "shop", status: "pending", amount: 208, amount_due: 208, payments: [] } } as unknown as PosOrderSnapshot;
const data = { siteId: "site", userId: "cashier", existingOrderId: "order", source: "pos", registerSessionId: "shift", originLocationId: "store",
  clientMutationId: "attempt", expectedOrderVersion: posOrderVersion(order), intent: "pay", promotionId: "promo",
  lines: [{ catalogItemId: "food", quantity: 2 }, { catalogItemId: "coffee", quantity: 2, unitPriceOverride: 32.5 }],
  payments: [{ paymentId: "original-receipt", method: "cash", amount: 273 }] };
const row = { siteId: "site", id: "row", status: "failed", recoveryState: "review_required", clientMutationId: "attempt",
  payload: { kind: "checkout", data } } as unknown as PosOutboxRow;
const getRow = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  getRow.mockResolvedValue(row);
  jest.mocked(getPosDb).mockReturnValue({ outbox: { get: getRow } } as never);
  jest.mocked(reconcilePosCheckout).mockResolvedValue({ state: "review_required", message: "Review" });
  jest.mocked(fetchPosOrder).mockResolvedValue({ data: order });
  jest.mocked(checkoutPosCart).mockResolvedValue({ success: true, saleId: "sale", orderId: "order" } as never);
});

it("confirms the unchanged queued cash, including its added lines and receipt ID, without creating a second operation", async () => {
  expect(canReviewReceivedCash(row, order)).toBe(true);
  await Promise.all([recoverReceivedCash("site", "row"), recoverReceivedCash("site", "row")]);
  expect(checkoutPosCart).toHaveBeenCalledTimes(1);
  expect(checkoutPosCart).toHaveBeenCalledWith({ ...data, recoverReceivedCash: true });
  expect(row.payload.data).not.toHaveProperty("recoverReceivedCash");
  expect(applyPosCheckoutRecovery).toHaveBeenCalledWith(row, expect.objectContaining({ state: "completed" }));
  expect(refreshPosSyncCounts).toHaveBeenCalledWith("site");
});

it.each(["payment_recorded", "rejected", "processing", "not_found"] as const)("does not submit a %s result", async state => {
  jest.mocked(reconcilePosCheckout).mockResolvedValue({ state, message: "Keep the original" });
  await expect(recoverReceivedCash("site", "row")).rejects.toThrow("Keep the original");
  expect(checkoutPosCart).not.toHaveBeenCalled();
});

it("does not submit again when the status read already recovered the payment", async () => {
  jest.mocked(reconcilePosCheckout).mockResolvedValue({ state: "completed", message: "Confirmed",
    result: { success: true, orderId: "order", saleId: "sale" } });
  await recoverReceivedCash("site", "row");
  expect(checkoutPosCart).not.toHaveBeenCalled();
});

it("rejects another cashier and a changed order version", async () => {
  getRow.mockResolvedValueOnce({ ...row, payload: { kind: "checkout", data: { ...data, userId: "different" } } });
  await expect(recoverReceivedCash("site", "row")).rejects.toThrow("cashier");
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  jest.mocked(fetchPosOrder).mockResolvedValue({ data: { ...order, total: 270 } });
  await expect(recoverReceivedCash("site", "row")).rejects.toThrow("changed");
  expect(checkoutPosCart).not.toHaveBeenCalled();
});

it.each([{ error: "Unconfirmed" }, { success: true, saleId: "different", orderId: "order" }])(
  "does not clear the queue on an ambiguous or unrelated checkout result", async result => {
    jest.mocked(checkoutPosCart).mockResolvedValue(result as never);
    await expect(recoverReceivedCash("site", "row")).rejects.toThrow();
    expect(applyPosCheckoutRecovery).not.toHaveBeenCalled();
  },
);