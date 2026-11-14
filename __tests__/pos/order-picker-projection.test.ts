import { projectPosOrderPicker } from "@/app/pos/local/order-picker-projection";
import type { LocalPendingOrder, PosOutboxRow } from "@/app/pos/local/types";

const order: LocalPendingOrder = { id: "order", site_id: "site", status: "pending", created_at: "2026-11-13T12:00:00Z",
  raw: { id: "order", status: "pending", notes: "Table 1", amount_due: 20,
    sales: { amount_due: 20, payments: [] } } };
const row: PosOutboxRow = { id: "row", siteId: "site", kind: "checkout", clientMutationId: "mutation",
  status: "pending", attempts: 0, createdAt: order.created_at, updatedAt: order.created_at, pickerAmountDueAfterPayment: 0,
  payload: { kind: "checkout", data: { siteId: "site", userId: "actor", clientMutationId: "mutation",
    existingOrderId: "order", lines: [], fulfillment: "pickup", source: "pos", intent: "pay",
    payments: [{ paymentId: "receipt", amount: 20, method: "cash" }] } } };

test.each(["pending", "syncing"] as const)("projects %s payments without inventing confirmed balances", status => {
  const before = JSON.stringify({ order, row });
  const result = projectPosOrderPicker("site", [order], [{ ...row, status }]);
  expect(result[0].raw).toMatchObject({ amount_due: 20, sales: { amount_due: 20 },
    pos_picker_payment_pending: true, pos_picker_message: "Payment confirmation pending" });
  expect(JSON.stringify({ order, row })).toBe(before);
});

test("rejecting or cancelling a payment immediately restores the original payable order", () => {
  expect(projectPosOrderPicker("site", [order], [{ ...row, status: "failed", recoveryState: "rejected" }])).toEqual([order]);
});

test("uncertain failures stay blocked rather than inviting a duplicate collection", () => {
  expect(projectPosOrderPicker("site", [order], [{ ...row, status: "failed", recoveryState: "review_required" }])[0].raw)
    .toMatchObject({ pos_picker_payment_pending: true, pos_picker_message: "Payment needs review · Check sync queue" });
});

test("a visible receipt does not release a checkout still requiring reconciliation", () => {
  const fresh = { ...order, raw: { ...order.raw, sales: { amount_due: 10, payments: [{ payment_id: "receipt" }] } } };
  expect(projectPosOrderPicker("site", [fresh], [{ ...row, status: "failed", recoveryState: "payment_recorded" }])[0].raw)
    .toMatchObject({ pos_picker_payment_pending: true });
});

test("confirmed full payment hides stale open snapshots without waiting for the next poll", () => {
  expect(projectPosOrderPicker("site", [order], [{ ...row, status: "synced" }])).toEqual([]);
  expect(projectPosOrderPicker("site", [order], [{ ...row, status: "synced" }])).toEqual([]);
});

test("partial payment waits for the actual balance and a matching receipt releases it", () => {
  const partial = { ...row, status: "synced" as const, pickerAmountDueAfterPayment: 10 };
  expect(projectPosOrderPicker("site", [order], [partial])[0].raw.pos_picker_payment_pending).toBe(true);
  const fresh = { ...order, raw: { ...order.raw, sales: { amount_due: 10, payments: [{ payment_id: "receipt", amount: 10 }] } } };
  expect(projectPosOrderPicker("site", [fresh], [partial])).toEqual([fresh]);
});

test("a later refund or added items are not hidden by an older confirmed payment", () => {
  const fresh = { ...order, raw: { ...order.raw, sales: { amount_due: 5, payments: [{ payment_id: "receipt" }] } } };
  expect(projectPosOrderPicker("site", [fresh], [{ ...row, status: "synced" }])).toEqual([fresh]);
});

test("new payments appear pending even before a server order exists and cancellation removes them", () => {
  const created: PosOutboxRow = { ...row, payload: { kind: "checkout", data: {
    ...row.payload.data, existingOrderId: undefined, notes: "Table 2",
  } } as PosOutboxRow["payload"] };
  expect(projectPosOrderPicker("site", [], [created])[0]).toMatchObject({ id: "local_mutation", raw: { notes: "Table 2" } });
  expect(projectPosOrderPicker("site", [], [{ ...created, status: "failed", recoveryState: "rejected" }])).toEqual([]);
});

test("local/server aliases do not duplicate a payment or leave a stale payable copy", () => {
  const aliased: PosOutboxRow = { ...row, resultOrderId: "order", payload: { kind: "checkout", data: {
    ...row.payload.data, existingOrderId: "local_original",
  } } as PosOutboxRow["payload"] };
  const local = { ...order, id: "local_original", raw: { ...order.raw, id: "local_original" } };
  expect(projectPosOrderPicker("site", [local, order], [aliased])).toHaveLength(1);
  expect(projectPosOrderPicker("site", [local, order], [{ ...aliased, status: "synced" }])).toEqual([]);
});

test("foreign-site evidence cannot hide or publish an order", () => {
  expect(projectPosOrderPicker("site", [order], [{ ...row, siteId: "foreign", status: "synced" }])).toEqual([order]);
  expect(projectPosOrderPicker("foreign", [order], [row])).toEqual([]);
});