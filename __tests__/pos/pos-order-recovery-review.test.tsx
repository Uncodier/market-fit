import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PosOrderReviewDialog } from "@/app/pos/components/PosOrderReviewDialog";
import { fetchPosOrder as getPosOrder } from "@/app/pos/operation-client";
import { listOutbox, updateOutboxRow, enqueueCheckout } from "@/app/pos/local/outbox";
import { reconcilePosCheckout } from "@/app/pos/local/checkout-recovery";
import { checkoutCart } from "@/app/commerce/checkout";
import type { PosOrderSnapshot } from "@/app/pos/order-snapshot";
import type { PosOutboxRow } from "@/app/pos/local/types";
import type { PosCheckoutRecovery } from "@/app/pos/checkout-recovery-types";

jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn(), updateOutboxRow: jest.fn(), enqueueCheckout: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn() }));
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}` }),
}));

const order = {
  id: "order-a", site_id: "site-a", sale_id: "sale-a", order_number: "POS-123",
  status: "pending", currency: "MXN", total: 100,
  sales: { amount: 100, amount_due: 100, payments: [], status: "pending" },
  sale_order_items: [{ id: "line-a", catalog_item_id: "coffee", name: "Coffee", quantity: 2,
    unit_price: 50, status: "pending", metadata: null, parent_sale_order_item_id: null }],
} as unknown as PosOrderSnapshot;
const baseRow: PosOutboxRow = {
  id: "original-row", siteId: "site-a", kind: "checkout", clientMutationId: "original-mutation",
  status: "failed", attempts: 1, recoveryState: "review_required",
  createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z",
  payload: { kind: "checkout", data: {
    siteId: "site-a", userId: "cashier", clientMutationId: "original-mutation",
    existingOrderId: "order-a", source: "pos", fulfillment: "pickup", intent: "pay",
    lines: [{ catalogItemId: "coffee", quantity: 2 }],
    payments: [{ paymentId: "original-receipt", method: "cash", amount: 100 }],
  } },
};
const props = { siteId: "site-a", rowId: "original-row", orderId: "order-a",
  onOpenChange: jest.fn(), onReloadOrder: jest.fn(), onContinueSelling: jest.fn() };
let rows: PosOutboxRow[];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function expectNoMoneyMutation() {
  expect(checkoutCart).not.toHaveBeenCalled();
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(updateOutboxRow).not.toHaveBeenCalled();
}
beforeEach(() => {
  jest.clearAllMocks();
  rows = [{ ...baseRow }];
  jest.mocked(listOutbox).mockReset().mockImplementation(async (siteId) => rows.filter((row) => row.siteId === siteId));
  jest.mocked(getPosOrder).mockReset().mockResolvedValue({ data: order });
  jest.mocked(reconcilePosCheckout).mockReset().mockResolvedValue({ state: "review_required", message: "Needs review" });
  props.onReloadOrder.mockReset().mockResolvedValue(true);
});

it("checks the original attempt from inside review without replay and displays refreshed evidence", async () => {
  const check = deferred<PosCheckoutRecovery>();
  jest.mocked(reconcilePosCheckout).mockReturnValueOnce(check.promise);
  render(<PosOrderReviewDialog {...props} orderId="stale-other-order" />);
  await screen.findByText("original-mutation");
  expect(getPosOrder).toHaveBeenCalledWith("site-a", "order-a");
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  fireEvent.click(screen.getByRole("button", { name: "Checking payment status…" }));
  await waitFor(() => expect(reconcilePosCheckout).toHaveBeenCalledTimes(1));
  expect(reconcilePosCheckout).toHaveBeenCalledWith("site-a", "original-row");
  rows = [{ ...baseRow, recoveryState: "payment_recorded", recoveryMessage: "Receipts confirmed" }];
  await act(async () => { check.resolve({ state: "payment_recorded", message: "Receipts confirmed" }); });
  expect(screen.getByText("Payment recorded — checkout not confirmed complete")).toBeInTheDocument();
  expect(screen.getByText("Receipts confirmed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload order for new confirmation" })).toBeDisabled();
  expect(screen.getByText("Queue row ID:").parentElement).toHaveTextContent("original-row");
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it("reviews new checkout details and checks status with no server order request", async () => {
  const row = { ...baseRow, payload: { ...baseRow.payload, data: { ...baseRow.payload.data, existingOrderId: undefined } } } as PosOutboxRow;
  rows = [row];
  render(<PosOrderReviewDialog {...props} orderId={undefined} />);
  await screen.findByText("original-mutation");
  expect(screen.getByText("Queued payment total:").parentElement).toHaveTextContent("100.00");
  expect(screen.getByText("2 × coffee")).toBeInTheDocument();
  expect(screen.getByText(/No server order is available yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await waitFor(() => expect(reconcilePosCheckout).toHaveBeenCalledWith("site-a", "original-row"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled());
  expect(getPosOrder).not.toHaveBeenCalled();
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it("reloads only a usable unpaid order after verifying the original durable rejection", async () => {
  rows = [{ ...baseRow, recoveryState: "rejected" }];
  jest.mocked(reconcilePosCheckout).mockResolvedValue({ state: "rejected", message: "Rejected before writes" });
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(screen.getByRole("button", { name: "Reload order for new confirmation" }));
  await waitFor(() => expect(props.onReloadOrder).toHaveBeenCalledWith("order-a"));
  expect(reconcilePosCheckout).toHaveBeenCalledWith("site-a", "original-row");
  expect(props.onContinueSelling).toHaveBeenCalledTimes(1);
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
  expect(rows[0]).toEqual({ ...baseRow, recoveryState: "rejected" });
  expectNoMoneyMutation();
});

it.each(["review_required", "payment_recorded"] as const)("cannot reload ambiguous %s evidence even with an unpaid order", async (recoveryState) => {
  rows = [{ ...baseRow, recoveryState }];
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  const reload = screen.getByRole("button", { name: "Reload order for new confirmation" });
  expect(reload).toBeDisabled();
  fireEvent.click(reload);
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it.each(["paid", "unknown", "empty", "cancelled", "foreign"])("cannot reload rejected evidence with a %s order", async (state) => {
  rows = [{ ...baseRow, recoveryState: "rejected" }];
  jest.mocked(getPosOrder).mockResolvedValue({ data: {
    ...order,
    ...(state === "paid" ? { sales: { ...order.sales!, amount_due: 0 } } : {}),
    ...(state === "unknown" ? { sales: null } : {}),
    ...(state === "empty" ? { sale_order_items: [] } : {}),
    ...(state === "cancelled" ? { status: "cancelled" } : {}),
    ...(state === "foreign" ? { site_id: "site-b" } : {}),
  } });
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  expect(screen.getByRole("button", { name: "Reload order for new confirmation" })).toBeDisabled();
  expect(props.onReloadOrder).not.toHaveBeenCalled();
});

it("does not reload when a fresh evidence check no longer confirms rejection", async () => {
  rows = [{ ...baseRow, recoveryState: "rejected" }];
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(screen.getByRole("button", { name: "Reload order for new confirmation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("requires a verified rejection");
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it("continues selling during a hanging status check without replay, deletion or cart reload", async () => {
  const check = deferred<PosCheckoutRecovery>();
  jest.mocked(reconcilePosCheckout).mockReturnValueOnce(check.promise);
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  expect(screen.getByText(/Continue selling leaves your current cart unchanged/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await waitFor(() => expect(reconcilePosCheckout).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Continue selling" }));
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
  expect(props.onContinueSelling).toHaveBeenCalledTimes(1);
  const reads = jest.mocked(listOutbox).mock.calls.length;
  await act(async () => { check.resolve({ state: "rejected", message: "Late rejection" }); });
  expect(listOutbox).toHaveBeenCalledTimes(reads);
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expect(rows).toEqual([baseRow]);
  expectNoMoneyMutation();
});

it.each(["site", "close"])("ignores a late reload decision after %s change", async (change) => {
  rows = [{ ...baseRow, recoveryState: "rejected" }];
  const check = deferred<PosCheckoutRecovery>();
  jest.mocked(reconcilePosCheckout).mockReturnValueOnce(check.promise);
  const view = render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(screen.getByRole("button", { name: "Reload order for new confirmation" }));
  await waitFor(() => expect(reconcilePosCheckout).toHaveBeenCalledTimes(1));
  view.rerender(<PosOrderReviewDialog {...props} siteId={change === "site" ? "site-b" : "site-a"}
    rowId={undefined} orderId={undefined} />);
  await act(async () => { check.resolve({ state: "rejected", message: "Late response" }); });
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expect(props.onContinueSelling).not.toHaveBeenCalled();
  expect(screen.queryByText("Late response")).not.toBeInTheDocument();
  expectNoMoneyMutation();
});

it("keeps a failed status check safe and allows another check", async () => {
  jest.mocked(reconcilePosCheckout).mockRejectedValueOnce(new Error("private details"));
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to check payment status");
  expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  expect(screen.getByText("original-mutation")).toBeInTheDocument();
  expectNoMoneyMutation();
});

it.each(["pending", "syncing", "synced"] as const)("does not reconcile %s rows or strand an unsent payment", async (status) => {
  rows = [{ ...baseRow, status, recoveryState: undefined }];
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  expect(screen.queryByRole("button", { name: "Check payment status" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload order for new confirmation" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue selling" }));
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it("does not reconcile an attempt that became pending after the review loaded", async () => {
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  rows = [{ ...baseRow, status: "pending", recoveryState: undefined }];
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await screen.findByText("Checkout waiting for synchronization");
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it("does not start a server order read after the original queue read outlives its session", async () => {
  const read = deferred<PosOutboxRow[]>();
  jest.mocked(listOutbox).mockReturnValueOnce(read.promise);
  const view = render(<PosOrderReviewDialog {...props} />);
  view.rerender(<PosOrderReviewDialog {...props} rowId={undefined} orderId={undefined} />);
  await act(async () => { read.resolve([baseRow]); });
  expect(getPosOrder).not.toHaveBeenCalled();
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
});

it("registers payment through the real payment callback only after consent and a fresh rejection check", async () => {
  rows = [{ ...baseRow, recoveryState: "rejected" }];
  jest.mocked(reconcilePosCheckout).mockResolvedValue({ state: "rejected", message: "No writes" });
  const onRegisterPayment = jest.fn().mockResolvedValue(true);
  render(<PosOrderReviewDialog {...props} onRegisterPayment={onRegisterPayment} />);
  await screen.findByText("original-mutation");
  expect(screen.getByRole("button", { name: "Register payment" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Register payment" }));
  await waitFor(() => expect(onRegisterPayment).toHaveBeenCalledWith("order-a"));
  expect(reconcilePosCheckout).toHaveBeenCalledWith("site-a", "original-row");
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it.each(["payment_recorded", "review_required"] as const)("prevents replacement payment for %s", async (recoveryState) => {
  rows = [{ ...baseRow, recoveryState }];
  const onRegisterPayment = jest.fn();
  render(<PosOrderReviewDialog {...props} onRegisterPayment={onRegisterPayment} />);
  await screen.findByText("original-mutation");
  expect(screen.getByRole("button", { name: "Register payment" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel operation" })).toBeEnabled();
  expect(onRegisterPayment).not.toHaveBeenCalled();
});