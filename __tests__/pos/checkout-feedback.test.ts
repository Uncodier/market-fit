import { confirmPosCheckoutInBackground } from "@/app/pos/checkout-feedback";
import { syncPosCheckout } from "@/app/pos/local/sync-engine";
import { printAfterPosCheckout } from "@/app/pos/print-after-checkout";
import { toast } from "sonner";
import type { PosOutboxRow } from "@/app/pos/local/types";

let current = true;
const first = jest.fn();
jest.mock("@/app/pos/local/location-permission-state", () => ({ isPosPermissionCurrent: () => current }));
jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ outbox: { where: () => ({ equals: () => ({ first }) }) } }) }));
jest.mock("@/app/pos/print-after-checkout", () => ({ printAfterPosCheckout: jest.fn() }));
jest.mock("sonner", () => ({ toast: { message: jest.fn(), success: jest.fn(), error: jest.fn() } }));

const row: PosOutboxRow = { id: "row", siteId: "site", clientMutationId: "mutation", kind: "checkout",
  status: "pending", attempts: 0, createdAt: "", updatedAt: "", payload: { kind: "checkout", data: {
    siteId: "site", userId: "actor", clientMutationId: "mutation", source: "pos", fulfillment: "pickup", lines: [],
    payments: [{ method: "cash", amount: 10 }],
  } } };
const input = { row, permission: null, print: { siteId: "site", intent: "pay" as const,
  settings: {} as Parameters<typeof printAfterPosCheckout>[0]["settings"], receipt: { lines: [], total: 10 } } };

beforeEach(() => {
  jest.resetAllMocks(); current = true;
  jest.mocked(syncPosCheckout).mockResolvedValue(undefined);
  first.mockResolvedValue({ ...row, status: "synced", resultOrderId: "order", resultOrderNumber: "POS-1" });
});

it("reports processing first and prints only after durable confirmation", async () => {
  let finish!: () => void;
  jest.mocked(syncPosCheckout).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const pending = confirmPosCheckoutInBackground(input);
  expect(toast.message).toHaveBeenCalledWith(expect.stringContaining("Confirming"), { id: "pos-checkout:row" });
  expect(toast.success).not.toHaveBeenCalled();
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
  finish(); await pending;
  expect(toast.success).toHaveBeenCalledWith("Order POS-1 confirmed.", { id: "pos-checkout:row" });
  expect(printAfterPosCheckout).toHaveBeenCalledWith(expect.objectContaining({ orderId: "order", orderNumber: "POS-1" }));
});

it("shares confirmation and printing when local cleanup retries the same pending receipt", async () => {
  let finish!: () => void;
  jest.mocked(syncPosCheckout).mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const original = confirmPosCheckoutInBackground(input);
  const retry = confirmPosCheckoutInBackground({ ...input, row: { ...row } });
  finish();
  await Promise.all([original, retry]);
  expect(syncPosCheckout).toHaveBeenCalledTimes(1);
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledTimes(1);
});

it("keeps the observer slot while the printer is still processing", async () => {
  let finishPrint!: () => void;
  jest.mocked(printAfterPosCheckout).mockReturnValueOnce(new Promise<void>((resolve) => { finishPrint = resolve; }));
  const original = confirmPosCheckoutInBackground(input);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
  const retry = confirmPosCheckoutInBackground(input);
  expect(retry).toBe(original);
  finishPrint(); await Promise.all([original, retry]);
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
});

it("releases an unconfirmed observer so a later status observation can succeed", async () => {
  first.mockResolvedValueOnce({ ...row, status: "failed" });
  await confirmPosCheckoutInBackground(input);
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
  await confirmPosCheckoutInBackground(input);
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(1);
  expect(syncPosCheckout).toHaveBeenCalledTimes(2);
});

it("does not make another receipt wait for a slow checkout", async () => {
  let finish!: () => void;
  jest.mocked(syncPosCheckout).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const original = confirmPosCheckoutInBackground(input);
  const other = { ...row, id: "other-row", clientMutationId: "other-mutation" };
  first.mockResolvedValueOnce({ ...other, status: "synced", resultOrderId: "other-order" });
  await confirmPosCheckoutInBackground({ ...input, row: other });
  expect(printAfterPosCheckout).toHaveBeenCalledWith(expect.objectContaining({ orderId: "other-order" }));
  finish(); await original;
  expect(syncPosCheckout).toHaveBeenCalledTimes(2);
  expect(printAfterPosCheckout).toHaveBeenCalledTimes(2);
});

it.each(["failed", "pending", "syncing"])("never prints or claims confirmation for %s", async (status) => {
  first.mockResolvedValue({ ...row, status });
  await confirmPosCheckoutInBackground(input);
  expect(toast.success).not.toHaveBeenCalled();
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
  expect(syncPosCheckout).toHaveBeenCalledTimes(1);
});

it("does not lose confirmation just because printing fails", async () => {
  jest.mocked(printAfterPosCheckout).mockRejectedValueOnce(new Error("Printer offline"));
  await confirmPosCheckoutInBackground(input);
  expect(toast.success).toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("printing failed"), expect.any(Object));
  expect(syncPosCheckout).toHaveBeenCalledTimes(1);
});

it("suppresses receipts and feedback when access changes", async () => {
  jest.mocked(syncPosCheckout).mockImplementationOnce(async () => { current = false; });
  await confirmPosCheckoutInBackground(input);
  expect(first).not.toHaveBeenCalled();
  expect(printAfterPosCheckout).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it("handles storage or transport failures without replay or an unhandled rejection", async () => {
  first.mockRejectedValueOnce(new Error("Storage unavailable"));
  await expect(confirmPosCheckoutInBackground(input)).resolves.toBeUndefined();
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("needs review"), expect.any(Object));
  expect(syncPosCheckout).toHaveBeenCalledTimes(1);
});