import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PosSyncIssues } from "@/app/pos/components/PosSyncIssues";
import { reconcilePosCheckoutStatus } from "@/app/pos/actions/reconcile-checkout";
import { checkoutCart } from "@/app/commerce/checkout";
import { getPosDb } from "@/app/pos/local/db";
import { enqueueCheckout, enqueueOutbox, listOutbox, updateOutboxRow } from "@/app/pos/local/outbox";
import { drainPosOutbox, refreshPosSyncCounts, subscribePosSync } from "@/app/pos/local/sync-engine";
import type { PosOutboxRow } from "@/app/pos/local/types";
import type { PosCheckoutRecovery } from "@/app/pos/checkout-recovery-types";

jest.mock("@/app/pos/actions/reconcile-checkout", () => ({ reconcilePosCheckoutStatus: jest.fn() }));
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: jest.fn(() => ({ userId: "cashier" })),
  isPosPermissionCurrent: jest.fn(() => true),
}));
jest.mock("@/app/pos/local/outbox", () => ({
  listOutbox: jest.fn(), updateOutboxRow: jest.fn(), mapLocalId: jest.fn(),
  enqueueOutbox: jest.fn(), enqueueCheckout: jest.fn(),
}));
jest.mock("@/app/pos/local/sync-engine", () => ({
  drainPosOutbox: jest.fn(), subscribePosSync: jest.fn(), refreshPosSyncCounts: jest.fn(),
}));

const payments = [
  { paymentId: "receipt-cash", method: "cash", amount: 12.25, tendered: 15, change: 2.75 },
  { paymentId: "receipt-card", method: "card", amount: 7.5 },
];
function checkoutRow(patch: Partial<PosOutboxRow> = {}): PosOutboxRow {
  return {
    id: "attempt-a", siteId: "site-a", kind: "checkout", clientMutationId: "mutation-a",
    payload: { kind: "checkout", data: {
      siteId: "site-a", userId: "cashier", clientMutationId: "mutation-a",
      fulfillment: "pickup", source: "pos", intent: "pay", lines: [], payments,
      existingOrderId: "existing-order", registerSessionId: "register-a",
    } },
    status: "failed", attempts: 3, lastError: "Checkout response was lost",
    createdAt: "2026-09-30T10:00:00Z", updatedAt: "2026-09-30T10:01:00Z",
    ...patch,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let storedRows: PosOutboxRow[];
let subscriptions: { siteId?: string; listener: () => void; unsubscribe: jest.Mock }[];
const onOpenChange = jest.fn();
const props = { siteId: "site-a", open: true, onOpenChange, t: (key: string) => key };

beforeEach(() => {
  jest.clearAllMocks();
  storedRows = [checkoutRow()];
  subscriptions = [];
  jest.mocked(listOutbox).mockReset().mockImplementation(async (siteId) => storedRows.filter((row) => row.siteId === siteId));
  jest.mocked(getPosDb).mockReturnValue({
    outbox: { get: jest.fn(async (id: string) => storedRows.find((row) => row.id === id)) },
    transaction: jest.fn(async (_mode: string, _table: unknown, action: () => Promise<void>) => action()),
  } as unknown as ReturnType<typeof getPosDb>);
  jest.mocked(updateOutboxRow).mockImplementation(async (id, patch) => {
    storedRows = storedRows.map((row) => row.id === id ? { ...row, ...patch } : row);
  });
  jest.mocked(subscribePosSync).mockImplementation((listener, siteId) => {
    const unsubscribe = jest.fn();
    subscriptions.push({ siteId, unsubscribe, listener: () => listener({
      online: true, pulling: false, syncing: false, pendingCount: 0, failedCount: 1,
      lastPulledAt: null, lastOrdersPulledAt: null, lastError: null,
    }) });
    return unsubscribe;
  });
  jest.mocked(drainPosOutbox).mockReset().mockResolvedValue(undefined);
  jest.mocked(refreshPosSyncCounts).mockResolvedValue(undefined);
  jest.mocked(reconcilePosCheckoutStatus).mockReset().mockResolvedValue({ data: {
    state: "payment_recorded", message: "Receipt exists; fulfillment still needs review.",
    orderId: "recovered-order", saleId: "recovered-sale",
  } });
});

function expectNoBlindRetry() {
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(enqueueOutbox).not.toHaveBeenCalled();
  expect(checkoutCart).not.toHaveBeenCalled();
  expect(drainPosOutbox).not.toHaveBeenCalled();
}

it("shows order/mutation diagnostics and the queued payment sum and methods", async () => {
  storedRows = [checkoutRow({ resultOrderId: "result-order", recoveryOrderId: "recovery-order", recoverySaleId: "recovery-sale" })];
  render(<PosSyncIssues {...props} />);
  await screen.findByRole("button", { name: "Check payment status" });
  for (const [label, value] of [
    ["Client mutation ID", "mutation-a"], ["Existing order ID", "existing-order"],
    ["Result order ID", "result-order"], ["Recovery order ID", "recovery-order"],
    ["Recovery sale ID", "recovery-sale"], ["Queued payment total", "19.75"],
    ["Payment method", "cash, card"],
  ]) {
    expect(screen.getByText(`${label}:`).parentElement).toHaveTextContent(value);
  }
  expect(screen.getByText("Checkout response was lost")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /delete|mark.*success/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Review order" })).not.toBeInTheDocument();
  expect(reconcilePosCheckoutStatus).not.toHaveBeenCalled();
  expectNoBlindRetry();
});

it("uses reconciliation to look up server status, blocks duplicate clicks, and refreshes persisted recovery", async () => {
  const lookup = deferred<Awaited<ReturnType<typeof reconcilePosCheckoutStatus>>>();
  jest.mocked(reconcilePosCheckoutStatus).mockReturnValueOnce(lookup.promise);
  render(<PosSyncIssues {...props} />);
  const check = await screen.findByRole("button", { name: "Check payment status" });
  fireEvent.click(check);
  fireEvent.click(check);
  expect(screen.getByRole("button", { name: "Checking payment status…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Retry sync" })).toBeDisabled();
  await waitFor(() => expect(reconcilePosCheckoutStatus).toHaveBeenCalledTimes(1));
  expect(reconcilePosCheckoutStatus).toHaveBeenCalledWith({
    siteId: "site-a", clientMutationId: "mutation-a", existingOrderId: "existing-order",
    registerSessionId: "register-a", payments,
  });
  expect(updateOutboxRow).not.toHaveBeenCalled();
  expectNoBlindRetry();
  await act(async () => { lookup.resolve({ data: {
    state: "payment_recorded", message: "Receipt exists; fulfillment still needs review.",
    orderId: "recovered-order", saleId: "recovered-sale",
  } }); });
  expect(await screen.findByText("Payment recorded — checkout not confirmed complete")).toBeInTheDocument();
  expect(screen.getByText(/Payment recorded does not mean the full checkout completed/)).toBeInTheDocument();
  expect(screen.getByText("Receipt exists; fulfillment still needs review.")).toBeInTheDocument();
  expect(screen.getByText("failed")).toBeInTheDocument();
  expect(screen.queryByText("synced")).not.toBeInTheDocument();
  expect(screen.getByText("Recovery order ID:").parentElement).toHaveTextContent("recovered-order");
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  expect(listOutbox).toHaveBeenCalledTimes(2);
  expectNoBlindRetry();
});

it.each([
  ["rejected", "Rejected — no payment recorded", /No payment was recorded for this attempt.*Reload and review the order before a new confirmation/],
  ["payment_recorded", "Payment recorded — checkout not confirmed complete", /Do not charge again/],
  ["review_required", "Review required — payment status needs review", /do not assume the payment failed/],
] as const)("keeps %s checkouts visibly failed with explicit recovery guidance", async (recoveryState, label, explanation) => {
  storedRows = [checkoutRow({ recoveryState, recoveryMessage: "Server recovery diagnostic" })];
  render(<PosSyncIssues {...props} />);
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.getByText(explanation)).toBeInTheDocument();
  expect(screen.getByText("Server recovery diagnostic")).toBeInTheDocument();
  expect(screen.getByText("failed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  expectNoBlindRetry();
});

it("shows checkout synchronized only when reconciliation returns explicit full completion", async () => {
  jest.mocked(reconcilePosCheckoutStatus).mockResolvedValueOnce({ data: {
    state: "completed", message: "Checkout completion confirmed by the server.",
    result: { success: true, orderId: "completed-order", saleId: "completed-sale" },
  } });
  render(<PosSyncIssues {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Check payment status" }));
  expect(await screen.findByText("synced")).toBeInTheDocument();
  expect(screen.getByText("Checkout completion confirmed by the server.")).toBeInTheDocument();
  expect(screen.getByText("Result order ID:").parentElement).toHaveTextContent("completed-order");
  expect(screen.queryByRole("button", { name: "Check payment status" })).not.toBeInTheDocument();
  expectNoBlindRetry();
});

it("shows status-check failure without hiding the attempt or retrying checkout", async () => {
  jest.mocked(reconcilePosCheckoutStatus).mockResolvedValueOnce({ error: "Status service is unavailable" });
  render(<PosSyncIssues {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Check payment status" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to check payment status. Try again. Status service is unavailable");
  expect(screen.getByText("mutation-a")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  expect(updateOutboxRow).not.toHaveBeenCalled();
  expectNoBlindRetry();
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await screen.findByText("Payment recorded — checkout not confirmed complete");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expectNoBlindRetry();
});

it("reports a list-read failure and lets the operator refresh without a checkout retry", async () => {
  jest.mocked(listOutbox).mockRejectedValueOnce(new Error("IndexedDB unavailable"));
  render(<PosSyncIssues {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading queued operations");
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load queued operations");
  expect(screen.queryByText("No queued operations")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh list" }));
  await screen.findByRole("button", { name: "Check payment status" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expectNoBlindRetry();
});

it("does not offer payment checks for pending/synced checkouts or other failed operations", async () => {
  storedRows = [checkoutRow({ id: "pending", status: "pending" }), checkoutRow({ id: "synced", status: "synced" }), {
    ...checkoutRow({ id: "lead", kind: "create_lead" }),
    payload: { kind: "create_lead", data: { siteId: "site-a", localLeadId: "local-lead", name: "Offline buyer", clientMutationId: "lead-mutation" } },
  }];
  render(<PosSyncIssues {...props} />);
  await screen.findByText("Offline buyer");
  expect(screen.queryByRole("button", { name: "Check payment status" })).not.toBeInTheDocument();
  expectNoBlindRetry();
});

it("shows zero queued payment and a legacy method without inventing a charge", async () => {
  const row = checkoutRow();
  if (row.payload.kind === "checkout") { row.payload.data.payments = []; row.payload.data.paymentMethod = "cash"; }
  storedRows = [row];
  render(<PosSyncIssues {...props} />);
  await screen.findByRole("button", { name: "Check payment status" });
  expect(screen.getByText("Queued payment total:").parentElement).toHaveTextContent("0.00");
  expect(screen.getByText("Payment method:").parentElement).toHaveTextContent("cash");
  expectNoBlindRetry();
});

it.each(["recovery", "result", "existing"])("closes before invoking optional order review using the %s order", async (source) => {
  storedRows = [checkoutRow({
    recoveryOrderId: source === "recovery" ? "review-target" : null,
    resultOrderId: source !== "existing" ? "result-target" : null,
  })];
  const events: string[] = [];
  const onReviewOrder = jest.fn((id: string) => events.push(id));
  render(<PosSyncIssues {...props} onOpenChange={(open) => events.push(`open:${open}`)} onReviewOrder={onReviewOrder} />);
  fireEvent.click(await screen.findByRole("button", { name: "Review order" }));
  expect(events).toEqual(["open:false", source === "recovery" ? "review-target" : source === "result" ? "result-target" : "existing-order"]);
  expectNoBlindRetry();
});

it("retains an explicit global retry with busy/error handling, separate from payment checking", async () => {
  const retry = deferred<void>();
  jest.mocked(drainPosOutbox).mockReturnValueOnce(retry.promise);
  render(<PosSyncIssues {...props} />);
  await screen.findByRole("button", { name: "Check payment status" });
  fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));
  expect(screen.getByRole("button", { name: "Retrying sync…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeDisabled();
  await act(async () => { retry.reject(new Error("Sync unavailable")); });
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to retry sync. Try again. Sync unavailable");
  expect(screen.getByRole("button", { name: "Retry sync" })).toBeEnabled();
  expect(drainPosOutbox).toHaveBeenCalledWith("site-a");
  expect(reconcilePosCheckoutStatus).not.toHaveBeenCalled();
  expect(checkoutCart).not.toHaveBeenCalled();
});

it("ignores stale site list responses and unsubscribes the previous site's updates", async () => {
  const firstRead = deferred<PosOutboxRow[]>();
  jest.mocked(listOutbox).mockReturnValueOnce(firstRead.promise);
  storedRows.push(checkoutRow({ id: "attempt-b", siteId: "site-b", clientMutationId: "mutation-b" }));
  const view = render(<PosSyncIssues {...props} />);
  view.rerender(<PosSyncIssues {...props} siteId="site-b" />);
  await screen.findByText("mutation-b");
  expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  expect(subscriptions[1].siteId).toBe("site-b");
  await act(async () => { firstRead.resolve([checkoutRow()]); subscriptions[0].listener(); });
  expect(screen.queryByText("mutation-a")).not.toBeInTheDocument();
  expect(listOutbox).toHaveBeenCalledTimes(2);
});

it("ignores a superseded same-site list read after a sync notification", async () => {
  const firstRead = deferred<PosOutboxRow[]>();
  jest.mocked(listOutbox).mockReturnValueOnce(firstRead.promise);
  const view = render(<PosSyncIssues {...props} />);
  storedRows = [checkoutRow({ clientMutationId: "latest-mutation" })];
  act(() => subscriptions[0].listener());
  await screen.findByText("latest-mutation");
  await act(async () => { firstRead.resolve([checkoutRow()]); });
  expect(within(screen.getByRole("dialog")).queryByText("mutation-a")).not.toBeInTheDocument();
  view.unmount();
  expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
});

it.each(["site", "close"])("does not leak late reconciliation failures into a new %s session", async (change) => {
  const lookup = deferred<Awaited<ReturnType<typeof reconcilePosCheckoutStatus>>>();
  jest.mocked(reconcilePosCheckoutStatus).mockReturnValueOnce(lookup.promise);
  const view = render(<PosSyncIssues {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Check payment status" }));
  await waitFor(() => expect(reconcilePosCheckoutStatus).toHaveBeenCalledTimes(1));
  if (change === "site") {
    storedRows = [checkoutRow({ id: "attempt-b", siteId: "site-b", clientMutationId: "mutation-b" })];
    view.rerender(<PosSyncIssues {...props} siteId="site-b" />);
  } else {
    view.rerender(<PosSyncIssues {...props} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(<PosSyncIssues {...props} />);
  }
  await screen.findByRole("button", { name: "Check payment status" });
  await act(async () => { lookup.reject(new Error("Old site failure")); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  expect(listOutbox).toHaveBeenCalledTimes(2);
  expectNoBlindRetry();
});

it("does not refresh a different site when an earlier reconciliation succeeds", async () => {
  const lookup = deferred<Awaited<ReturnType<typeof reconcilePosCheckoutStatus>>>();
  jest.mocked(reconcilePosCheckoutStatus).mockReturnValueOnce(lookup.promise);
  const view = render(<PosSyncIssues {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Check payment status" }));
  await waitFor(() => expect(reconcilePosCheckoutStatus).toHaveBeenCalledTimes(1));
  storedRows.push(checkoutRow({ id: "attempt-b", siteId: "site-b", clientMutationId: "mutation-b" }));
  view.rerender(<PosSyncIssues {...props} siteId="site-b" />);
  await screen.findByText("mutation-b");
  const recovery: PosCheckoutRecovery = { state: "payment_recorded", message: "Old site result", orderId: "old-order" };
  await act(async () => { lookup.resolve({ data: recovery }); });
  expect(screen.queryByText("Old site result")).not.toBeInTheDocument();
  expect(screen.queryByText("mutation-a")).not.toBeInTheDocument();
  expect(listOutbox).toHaveBeenCalledTimes(2);
  expectNoBlindRetry();
});

it("ignores list reads from a closed session when the same site reopens", async () => {
  const read = deferred<PosOutboxRow[]>();
  jest.mocked(listOutbox).mockReturnValueOnce(read.promise);
  const view = render(<PosSyncIssues {...props} />);
  view.rerender(<PosSyncIssues {...props} open={false} />);
  storedRows = [];
  view.rerender(<PosSyncIssues {...props} />);
  await screen.findByText("No queued operations");
  await act(async () => { read.resolve([checkoutRow()]); });
  expect(screen.queryByText("mutation-a")).not.toBeInTheDocument();
  expect(listOutbox).toHaveBeenCalledTimes(2);
});

it("does not read, subscribe or retry without an open dialog and a site", () => {
  const view = render(<PosSyncIssues {...props} open={false} />);
  view.rerender(<PosSyncIssues {...props} siteId={undefined} />);
  expect(screen.getByRole("button", { name: "Retry sync" })).toBeDisabled();
  expect(listOutbox).not.toHaveBeenCalled();
  expect(subscribePosSync).not.toHaveBeenCalled();
  expectNoBlindRetry();
});