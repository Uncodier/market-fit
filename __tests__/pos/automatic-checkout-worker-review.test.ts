import { syncPosOutboxRow } from "@/app/pos/local/sync-outbox-worker";
import { getPosDb } from "@/app/pos/local/db";
import { updateOutboxRow } from "@/app/pos/local/outbox";
import { applyOutboxItem } from "@/app/pos/local/sync-outbox-item";
import { syncCheckoutDependencies } from "@/app/pos/local/sync-checkout-dependencies";
import { reconcilePosCheckout } from "@/app/pos/local/checkout-recovery";
import { canStartPosRemoteRequest } from "@/app/pos/local/remote-permission";
import type { PosOutboxRow } from "@/app/pos/local/types";
import type { PosPermissionLease } from "@/app/pos/local/location-permission-state";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ updateOutboxRow: jest.fn() }));
jest.mock("@/app/pos/local/sync-outbox-item", () => ({ applyOutboxItem: jest.fn() }));
jest.mock("@/app/pos/local/sync-checkout-dependencies", () => ({ syncCheckoutDependencies: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn(), applyPosCheckoutRecovery: jest.fn() }));
jest.mock("@/app/pos/local/sync-errors", () => ({ clearPosSyncError: jest.fn(), recordPosSyncError: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({ isPosPermissionCurrent: () => true }));
jest.mock("@/app/pos/local/remote-permission", () => ({ canStartPosRemoteRequest: jest.fn(() => true) }));

const permission: PosPermissionLease = { siteId: "site", userId: "actor", role: "marketing", generation: 1, expiresAt: Infinity };
let row: PosOutboxRow;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const changed = jest.fn();
const run = () => syncPosOutboxRow(clone(row), permission, changed);

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.mocked(canStartPosRemoteRequest).mockReturnValue(true);
  row = { id: "row", siteId: "site", kind: "checkout", status: "pending", attempts: 0,
    createdAt: "2026-10-28T12:00:00Z", updatedAt: "2026-10-28T12:00:00Z", clientMutationId: "operation",
    payload: { kind: "checkout", data: { source: "pos", siteId: "site", userId: "actor", clientMutationId: "operation",
      fulfillment: "pickup", lines: [], payments: [], posOperationIdentity: {
        version: 1, deviceId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-10-28T12:00:00Z",
      },
    } },
  };
  jest.mocked(getPosDb).mockReturnValue({
    outbox: { get: async () => clone(row) },
    transaction: async (_mode: string, _table: unknown, work: () => Promise<unknown>) => work(),
  } as never);
  jest.mocked(updateOutboxRow).mockImplementation(async (_id, patch) => { Object.assign(row, patch); });
  jest.mocked(applyOutboxItem).mockImplementation(async (_row, _permission, dispatch) => {
    dispatch?.();
    row.status = "synced";
  });
});
afterEach(() => { jest.useRealTimers(); });

it("does not delay an unsent operation after failed dependencies become available", async () => {
  jest.mocked(syncCheckoutDependencies).mockRejectedValueOnce(new Error("Waiting for local lead to sync"));
  await run();
  expect(row).toMatchObject({ status: "pending", attempts: 0 });
  expect(row.checkoutRecoveryChecks).toBeUndefined();
  expect(row.checkoutRetryAfter).toBeUndefined();
  await run();
  expect(applyOutboxItem).toHaveBeenCalledTimes(1);
  expect(row.status).toBe("synced");
});

it("restores the original cooldown when final dependency resolution fails before dispatch", async () => {
  jest.mocked(applyOutboxItem).mockRejectedValueOnce(new Error("Waiting for local lead to sync"));
  await run();
  expect(row).toMatchObject({ status: "pending", attempts: 0 });
  expect(row.checkoutRetryAfter).toBeUndefined();
  await run();
  expect(applyOutboxItem).toHaveBeenCalledTimes(2);
  expect(row.status).toBe("synced");
});

it.each([undefined, "review_required"] as const)("recovers unpaid marketing operations through admission (local evidence: %s)", async (recoveryState) => {
  row.status = "failed";
  row.attempts = 1;
  row.recoveryState = recoveryState;
  jest.mocked(reconcilePosCheckout).mockRejectedValue(new Error("Forbidden checkout recovery"));
  const payload = clone(row.payload);
  await run();
  expect(reconcilePosCheckout).not.toHaveBeenCalled();
  expect(applyOutboxItem).toHaveBeenCalledWith(expect.objectContaining({ payload }), permission, expect.any(Function));
  expect(row.status).toBe("synced");
});

it("does not extend the unpaid bypass to payments when payment status is forbidden", async () => {
  if (row.payload.kind !== "checkout") throw new Error("Expected checkout");
  row.payload.data.payments = [{ paymentId: "receipt", method: "cash", amount: 10 }];
  row.status = "failed";
  row.attempts = 1;
  jest.mocked(reconcilePosCheckout).mockRejectedValue(new Error("Forbidden checkout recovery"));
  await run();
  expect(reconcilePosCheckout).toHaveBeenCalledTimes(1);
  expect(applyOutboxItem).not.toHaveBeenCalled();
});

it.each(["rejected", "payment_recorded"] as const)("does not dispatch unpaid operations with %s evidence", async (recoveryState) => {
  row.status = "failed";
  row.recoveryState = recoveryState;
  await run();
  expect(applyOutboxItem).not.toHaveBeenCalled();
});

it("retains a failed-operation cooldown across an actual worker module reload", async () => {
  row.status = "failed";
  row.attempts = 1;
  row.checkoutRetryAfter = Date.now() + 60_000;
  await jest.isolateModulesAsync(async () => {
    const db = await import("@/app/pos/local/db");
    jest.mocked(db.getPosDb).mockReturnValue(jest.mocked(getPosDb)());
    const remote = await import("@/app/pos/local/remote-permission");
    jest.mocked(remote.canStartPosRemoteRequest).mockReturnValue(true);
    const worker = await import("@/app/pos/local/sync-outbox-worker");
    await worker.syncPosOutboxRow(clone(row), permission, changed);
    const item = await import("@/app/pos/local/sync-outbox-item");
    expect(item.applyOutboxItem).not.toHaveBeenCalled();
  });
  expect(row.status).toBe("failed");
  expect(row.attempts).toBe(1);
});