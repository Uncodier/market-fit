import { printLocalPosReceipt } from "@/app/pos/print-local-receipt";
import { printAfterPosCheckout } from "@/app/pos/print-after-checkout";
import type { PosOutboxRow } from "@/app/pos/local/types";

let current = true;
jest.mock("@/app/pos/local/location-permission-state", () => ({ isPosPermissionCurrent: () => current }));
jest.mock("@/app/pos/print-after-checkout", () => ({ printAfterPosCheckout: jest.fn() }));
const row: PosOutboxRow = { id: "row", siteId: "site", clientMutationId: "mutation", kind: "checkout",
  status: "pending", attempts: 0, createdAt: "2026-11-03T12:00:00Z", updatedAt: "", payload: { kind: "checkout", data: {
    siteId: "site", userId: "actor", clientMutationId: "mutation", source: "pos", fulfillment: "pickup", lines: [],
    payments: [{ method: "cash", amount: 10 }],
  } } };
const input = { row, permission: null, print: { siteId: "site", intent: "pay" as const,
  settings: { devices: [] }, receipt: { lines: [], total: 10, qrValue: "old-order", orderNumber: "old-order" } } };

beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); current = true;
  let tail: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, _options: LockOptions, action: () => Promise<unknown>) => {
      const next = tail.then(action); tail = next.catch(() => {}); return next;
    },
  } });
});
afterEach(() => jest.restoreAllMocks());

it("prints a pending snapshot with a stable local reference, without a fake order QR", async () => {
  await printLocalPosReceipt(input);
  expect(printAfterPosCheckout).toHaveBeenCalledWith(expect.objectContaining({
    receiptJobId: "receipt-mutation", orderId: null, orderNumber: null, kitchenDelta: null,
    createdAt: row.createdAt, receipt: expect.objectContaining({
      confirmationPending: true, localReference: "mutation", total: 10, orderNumber: null, qrValue: null,
    }),
  }));
  expect(input.print.receipt.orderNumber).toBe("old-order");
});

it("claims once across concurrent callers and later remount-style retries", async () => {
  await Promise.all([printLocalPosReceipt(input), printLocalPosReceipt(input)]);
  await printLocalPosReceipt({ ...input, row: { ...row } });
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
});

it("never repeats the receipt when confirmation arrives", async () => {
  await printLocalPosReceipt(input);
  await printLocalPosReceipt({ ...input, row: { ...row, status: "synced", resultOrderId: "order", resultOrderNumber: "POS-1" } });
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
});

it("uses confirmed metadata if already confirmed on first observation", async () => {
  await printLocalPosReceipt({ ...input, row: { ...row, status: "synced", resultOrderId: "order", resultOrderNumber: "POS-1" } });
  expect(printAfterPosCheckout).toHaveBeenCalledWith(expect.objectContaining({
    orderId: "order", receipt: expect.objectContaining({ confirmationPending: false, orderNumber: "POS-1" }),
  }));
});

it("ignores unavailable hardware and never replays a possibly partial print", async () => {
  jest.mocked(printAfterPosCheckout).mockRejectedValueOnce(new Error("Printer disconnected"));
  await expect(printLocalPosReceipt(input)).resolves.toBeUndefined();
  await printLocalPosReceipt(input);
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
});

it("keeps different payment attempts independent", async () => {
  await printLocalPosReceipt(input);
  await printLocalPosReceipt({ ...input, row: { ...row, clientMutationId: "second-payment" } });
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(2);
});

it("does not print when permission is lost before dispatch", async () => {
  const pending = printLocalPosReceipt(input);
  current = false;
  await pending;
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
});

it.each(["failed", "review_required"])("does not print known failed/recovery attempts: %s", async (state) => {
  await printLocalPosReceipt({ ...input, row: state === "failed" ? { ...row, status: "failed" } : { ...row, recoveryState: "review_required" } });
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
});

it("skips printing if a durable dedupe claim cannot be stored", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
  await expect(printLocalPosReceipt(input)).resolves.toBeUndefined();
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
});