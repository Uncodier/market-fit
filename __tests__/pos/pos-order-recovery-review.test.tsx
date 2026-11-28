import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PosOrderReviewDialog } from "@/app/pos/components/PosOrderReviewDialog";
import { fetchPosOrder as getPosOrder } from "@/app/pos/operation-client";
import { listOutbox, updateOutboxRow, enqueueCheckout } from "@/app/pos/local/outbox";
import { reconcilePosCheckout } from "@/app/pos/local/checkout-recovery";
import { recoverReceivedCash } from "@/app/pos/local/recover-received-cash";
import { posOrderVersion } from "@/app/pos/order-version";
import { checkoutCart } from "@/app/commerce/checkout";
import type { PosOrderSnapshot } from "@/app/pos/order-snapshot";
import type { PosOutboxRow } from "@/app/pos/local/types";
import type { PosCheckoutRecovery } from "@/app/pos/checkout-recovery-types";

jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn(), updateOutboxRow: jest.fn(), enqueueCheckout: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn() }));
const mockBulkGet = jest.fn();
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ catalogItems: { bulkGet: mockBulkGet } }) }));
jest.mock("@/app/pos/local/recover-received-cash", () => ({
  ...jest.requireActual("@/app/pos/local/recover-received-cash"), recoverReceivedCash: jest.fn(),
}));
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
  mockBulkGet.mockReset().mockResolvedValue([]);
  rows = [{ ...baseRow }];
  jest.mocked(listOutbox).mockReset().mockImplementation(async (siteId) => rows.filter((row) => row.siteId === siteId));
  jest.mocked(getPosOrder).mockReset().mockResolvedValue({ data: order });
  jest.mocked(reconcilePosCheckout).mockReset().mockResolvedValue({ state: "review_required", message: "Needs review" });
  props.onReloadOrder.mockReset().mockResolvedValue(true);
  jest.mocked(recoverReceivedCash).mockReset();
});

function eligibleCash() {
  if (baseRow.payload.kind !== "checkout") throw new Error("Missing checkout fixture");
  const promoOrder = { ...order, origin_location_id: "store", promotion_id: "promo", discount_total: 10,
    sales: { ...order.sales!, source: "shop" } };
  rows = [{ ...baseRow, payload: { kind: "checkout", data: { ...baseRow.payload.data, promotionId: "promo",
    registerSessionId: "register", originLocationId: "store", expectedOrderVersion: posOrderVersion(promoOrder),
    lines: [{ catalogItemId: "coffee", quantity: 3 }],
    payments: [{ paymentId: "original-receipt", method: "cash", amount: 140 }] } } }];
  jest.mocked(getPosOrder).mockResolvedValue({ data: promoOrder });
  return promoOrder;
}
const cashButton = () => screen.getByRole("button", { name: "Sync received cash" });
const cashConsent = () => screen.getByRole("checkbox", { name: /already received exactly MXN 140.00 in cash/ });
function expectNoReplacementOrCancel() {
  for (const name of ["Register payment", "Reload order for new confirmation", "Cancel operation"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  }
}

it("compares registered and queued details, requires exact cash consent and refreshes the original attempt once", async () => {
  eligibleCash();
  const work = deferred<void>();
  jest.mocked(recoverReceivedCash).mockReturnValue(work.promise);
  const onRegisterPayment = jest.fn();
  render(<PosOrderReviewDialog {...props} onRegisterPayment={onRegisterPayment} />);
  await screen.findByRole("heading", { name: "Registered order items" });
  expect(screen.getByText("2 × MXN 50.00")).toBeInTheDocument();
  expect(screen.getByText("3 × Coffee")).toBeInTheDocument();
  expect(screen.getByText("Queued payment total:").parentElement).toHaveTextContent("MXN 140.00");
  expect(screen.getByText("Balance due").parentElement).toHaveTextContent("MXN 100.00");
  expect(cashButton()).toBeDisabled();
  expectNoReplacementOrCancel();
  fireEvent.click(cashButton());
  expect(recoverReceivedCash).not.toHaveBeenCalled();
  fireEvent.click(cashConsent());
  fireEvent.click(cashButton());
  await waitFor(() => expect(recoverReceivedCash).toHaveBeenCalledWith("site-a", "original-row"));
  const retrying = screen.getByRole("button", { name: "Syncing received cash…" });
  expect(retrying).toBeDisabled();
  fireEvent.click(retrying);
  expectNoReplacementOrCancel();
  rows = [{ ...rows[0], status: "synced" }];
  await act(async () => { work.resolve(); });
  expect(screen.getByText("Checkout completion confirmed")).toBeInTheDocument();
  expectNoReplacementOrCancel();
  expect(screen.queryByRole("button", { name: "Check payment status" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue selling" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Sync received cash" })).not.toBeInTheDocument();
  expect(recoverReceivedCash).toHaveBeenCalledTimes(1);
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  expect(onRegisterPayment).not.toHaveBeenCalled();
  expect(props.onReloadOrder).not.toHaveBeenCalled();
  expectNoMoneyMutation();
});

it.each(["amount", "items", "eligibility"])("rechecks %s and discards stale consent before retrying", async (change) => {
  eligibleCash();
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(cashConsent());
  const row = rows[0];
  if (row.payload.kind !== "checkout") throw new Error("Missing checkout fixture");
  if (change === "eligibility") rows = [{ ...row, recoveryState: "payment_recorded" }];
  else rows = [{ ...row, payload: { kind: "checkout", data: { ...row.payload.data, ...(change === "amount"
    ? { payments: [{ paymentId: "original-receipt", amount: 145, method: "cash" }] }
    : { lines: [{ catalogItemId: "tea", quantity: 3 }] }) } } }];
  fireEvent.click(cashButton());
  expect(await screen.findByRole("alert")).toHaveTextContent("Payment details changed");
  if (change !== "eligibility") expect(cashButton()).toBeDisabled();
  else expect(screen.queryByRole("button", { name: "Sync received cash" })).not.toBeInTheDocument();
  expect(recoverReceivedCash).not.toHaveBeenCalled();
});

it("names added items using only the same site's catalog and keeps unknown identifiers visible", async () => {
  eligibleCash();
  const row = rows[0];
  if (row.payload.kind !== "checkout") throw new Error("Missing checkout fixture");
  rows = [{ ...row, payload: { kind: "checkout", data: { ...row.payload.data, lines: [
    ...row.payload.data.lines, { catalogItemId: "item-new", quantity: 2, modifiers: [{ catalogItemId: "mod-x", quantity: 1 }] },
  ] } } }];
  mockBulkGet.mockResolvedValue([
    { site_id: "site-a", id: "item-new", name: "Lemon cake" },
    { site_id: "site-b", id: "mod-x", name: "Private item" },
  ]);
  render(<PosOrderReviewDialog {...props} />);
  expect(await screen.findByText("2 × Lemon cake")).toBeInTheDocument();
  expect(mockBulkGet).toHaveBeenCalledWith(["item-new", "mod-x"]);
  expect(screen.getByText("2 × mod-x")).toBeInTheDocument();
  expect(screen.queryByText(/Private item/)).not.toBeInTheDocument();
});

it("refreshes evidence on failure without assuming the payment failed or exposing private details", async () => {
  eligibleCash();
  jest.mocked(recoverReceivedCash).mockRejectedValueOnce(new Error("private transport details"));
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(cashConsent());
  fireEvent.click(cashButton());
  expect(await screen.findByRole("alert")).toHaveTextContent("Do not collect cash again");
  await waitFor(() => expect(getPosOrder).toHaveBeenCalledTimes(3));
  expect(screen.queryByText(/private transport/)).not.toBeInTheDocument();
  expect(cashConsent()).not.toBeChecked();
  expect(cashButton()).toBeDisabled();
});

it("requires fresh consent after refreshing the order", async () => {
  eligibleCash();
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  fireEvent.click(cashConsent());
  fireEvent.click(screen.getByRole("button", { name: "Refresh order" }));
  await waitFor(() => expect(cashConsent()).toBeEnabled());
  expect(cashButton()).toBeDisabled();
  expect(recoverReceivedCash).not.toHaveBeenCalled();
});

it("does not start recovery after the review closes during the fresh order read", async () => {
  const original = eligibleCash();
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("original-mutation");
  const read = deferred<{ data: PosOrderSnapshot }>();
  jest.mocked(getPosOrder).mockReturnValueOnce(read.promise);
  fireEvent.click(cashConsent());
  fireEvent.click(cashButton());
  await waitFor(() => expect(getPosOrder).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Continue selling" }));
  await act(async () => { read.resolve({ data: original }); });
  expect(recoverReceivedCash).not.toHaveBeenCalled();
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
  if (status === "synced") expectNoReplacementOrCancel();
  else expect(screen.getByRole("button", { name: "Reload order for new confirmation" })).toBeDisabled();
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
  expect(screen.queryByRole("button", { name: "Sync received cash" })).not.toBeInTheDocument();
  expect(onRegisterPayment).not.toHaveBeenCalled();
});