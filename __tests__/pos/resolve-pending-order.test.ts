import { resolvePendingOrder } from "@/app/pos/local/resolve-pending-order";
import { syncPosCheckout, drainPosOutbox } from "@/app/pos/local/sync-engine";
import { listOutbox } from "@/app/pos/local/outbox";
import { getPosDb } from "@/app/pos/local/db";
import { requirePosPermission, isPosPermissionCurrent } from "@/app/pos/local/location-permission-state";
import type { CheckoutOutboxPayload, IdMapRow, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn(), drainPosOutbox: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: jest.fn(), isPosPermissionCurrent: jest.fn(),
}));

let rows: PosOutboxRow[];
let mappings: IdMapRow[];
const checkout = (id: string, data: Partial<CheckoutOutboxPayload> = {}): PosOutboxRow => ({
  id: `row-${id}`, siteId: "site", clientMutationId: id, kind: "checkout", status: "pending", attempts: 0,
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  payload: { kind: "checkout", data: { siteId: "site", userId: "cashier", clientMutationId: id,
    source: "pos", fulfillment: "pickup", intent: "send", payments: [],
    lines: [{ catalogItemId: "sku", quantity: 1 }], ...data } },
});
const mapping = (serverId = "server-order"): IdMapRow => ({
  localId: "local_original", serverId, siteId: "site", kind: "order",
});

describe("safe pending POS order resolution", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    rows = [checkout("original")];
    mappings = [];
    jest.mocked(requirePosPermission).mockReturnValue({ siteId: "site", userId: "cashier", role: "owner",
      generation: 1, expiresAt: Date.now() + 30_000 });
    jest.mocked(isPosPermissionCurrent).mockReturnValue(true);
    jest.mocked(listOutbox).mockImplementation(async () => rows);
    jest.mocked(getPosDb).mockReturnValue({ idMaps: { toArray: async () => mappings } } as never);
    jest.mocked(syncPosCheckout).mockImplementation(async (_siteId, mutationId) => {
      const row = rows.find((candidate) => candidate.clientMutationId === mutationId)!;
      row.status = "synced";
      row.resultOrderId = "server-order";
    });
  });

  it("pushes only the old unpaid original mutation and ignores another queue entry", async () => {
    rows.unshift({ ...checkout("other", { payments: [{ method: "cash", amount: 5 }] }), status: "failed" });
    const payload = JSON.parse(JSON.stringify(rows[1].payload));
    await expect(resolvePendingOrder("site", "local_original")).resolves.toBe("server-order");
    expect(syncPosCheckout).toHaveBeenCalledTimes(1);
    expect(syncPosCheckout).toHaveBeenCalledWith("site", "original");
    expect(drainPosOutbox).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("failed");
    expect(rows[1].payload).toEqual(payload);
  });

  it("explains a cancelled local creator instead of reporting an unresolvable payment conflict", async () => {
    rows[0].status = "failed";
    rows[0].recoveryState = "rejected";
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("cancelled before creation");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("does not replay rejected payment attempts when loading their existing server order", async () => {
    rows = [{ ...checkout("payment", { existingOrderId: "server-order", payments: [{ method: "cash", amount: 5 }] }),
      status: "failed", recoveryState: "rejected" }];
    await expect(resolvePendingOrder("site", "server-order")).resolves.toBe("server-order");
    expect(syncPosCheckout).not.toHaveBeenCalled();
    expect(rows[0].recoveryState).toBe("rejected");
  });

  it("synchronizes only related unpaid updates before using the latest server ID", async () => {
    rows.push(checkout("edit", { existingOrderId: "local_original" }), checkout("other"));
    await expect(resolvePendingOrder("site", "local_original")).resolves.toBe("server-order");
    expect(jest.mocked(syncPosCheckout).mock.calls).toEqual([["site", "original"], ["site", "edit"]]);
    expect(rows[2].status).toBe("pending");
  });

  it("pushes matching unpaid server-order changes, not other local work", async () => {
    rows = [checkout("original", { existingOrderId: "server-order" }), checkout("other")];
    await expect(resolvePendingOrder("site", "server-order")).resolves.toBe("server-order");
    expect(syncPosCheckout).toHaveBeenCalledWith("site", "original");
    expect(syncPosCheckout).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "failed", "syncing"] as const)("never submits a %s collected-payment row from selection", async (status) => {
    rows = [{ ...checkout("original", { payments: [{ method: "cash", amount: 5 }] }), status }];
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("Check payment status");
    expect(syncPosCheckout).not.toHaveBeenCalled();
    expect(rows[0].status).toBe(status);
  });

  it.each(["rejected", "review_required", "payment_recorded"] as const)("retains %s evidence and does not retry", async (recoveryState) => {
    rows[0].recoveryState = recoveryState;
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("Check payment status");
    expect(syncPosCheckout).not.toHaveBeenCalled();
    expect(rows[0].recoveryState).toBe(recoveryState);
  });

  it("refuses before sending an unpaid creator when its related payment is uncertain", async () => {
    rows.push({ ...checkout("payment", { existingOrderId: "local_original", payments: [{ method: "cash", amount: 5 }] }),
      status: "failed" });
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("Check payment status");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("refuses a missing or misidentified local creator dependency before dispatch", async () => {
    rows = [checkout("edit", { existingOrderId: "local_original" }), checkout("original", { existingOrderId: "other-order" })];
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("does not match");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("finds uncertain local payment aliases when the selector already has a server ID", async () => {
    rows[0] = { ...rows[0], status: "synced", resultOrderId: "server-order" };
    rows.push(checkout("payment", { existingOrderId: "local_original", payments: [{ method: "cash", amount: 5 }] }));
    await expect(resolvePendingOrder("site", "server-order")).rejects.toThrow("Check payment status");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("resolves stale local and server pending stubs from retained synced payment evidence without replay", async () => {
    rows = [{ ...checkout("original", { payments: [{ method: "cash", amount: 5 }] }),
      status: "synced", resultOrderId: "server-order" }];
    await expect(resolvePendingOrder("site", "local_original")).resolves.toBe("server-order");
    await expect(resolvePendingOrder("site", "server-order")).resolves.toBe("server-order");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("accepts a retained typed mapping only with the matching synced original checkout", async () => {
    rows[0].status = "synced";
    mappings = [mapping()];
    await expect(resolvePendingOrder("site", "local_original")).resolves.toBe("server-order");
    expect(syncPosCheckout).not.toHaveBeenCalled();
    rows = [];
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("No original checkout");
  });

  it.each([
    { siteId: "other" }, { kind: "lead" as const }, { serverId: "different-order" },
  ])("fails closed for a mismatched mapping: %o", async (patch) => {
    rows[0].resultOrderId = "server-order";
    mappings = [{ ...mapping(), ...patch }];
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("does not match");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it.each([
    { siteId: "other" }, { userId: "other" }, { clientMutationId: "different" }, { lines: [] },
  ])("does not dispatch an incomplete or foreign checkout: %o", async (patch) => {
    rows = [checkout("original", patch)];
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("does not match");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("joins only the selected in-flight unpaid row and requires its confirmed result", async () => {
    rows[0].status = "syncing";
    await expect(resolvePendingOrder("site", "local_original")).resolves.toBe("server-order");
    expect(syncPosCheckout).toHaveBeenCalledWith("site", "original");
    expect(syncPosCheckout).toHaveBeenCalledTimes(1);
  });

  it("refuses an unpaid row that remains in flight after the targeted wait", async () => {
    rows[0].status = "syncing";
    jest.mocked(syncPosCheckout).mockResolvedValue(undefined);
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("still saved");
    expect(syncPosCheckout).toHaveBeenCalledTimes(1);
  });

  it("keeps a timed-out unpaid attempt saved and does not claim success or dispatch it twice", async () => {
    const original = JSON.parse(JSON.stringify(rows[0]));
    jest.mocked(syncPosCheckout).mockImplementation(async () => {
      rows[0] = { ...rows[0], status: "failed", attempts: 1, lastError: "Sync timed out" };
    });
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("still saved");
    expect(syncPosCheckout).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: original.id, clientMutationId: original.clientMutationId,
      payload: original.payload, status: "failed", lastError: "Sync timed out" });
  });

  it("refuses a conflicting targeted sync result", async () => {
    rows = [checkout("original", { existingOrderId: "different-order" })];
    await expect(resolvePendingOrder("site", "different-order")).rejects.toThrow("does not match");
    expect(rows[0].resultOrderId).toBe("server-order");
  });

  it("does not proceed when a targeted push leaves no server result", async () => {
    jest.mocked(syncPosCheckout).mockImplementation(async () => { rows[0].status = "synced"; });
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("does not match");
  });

  it("does not treat an existing server ID alone as proof of a synced result", async () => {
    rows = [{ ...checkout("original", { existingOrderId: "server-order" }), status: "synced" }];
    await expect(resolvePendingOrder("site", "server-order")).rejects.toThrow("does not match");
    expect(syncPosCheckout).not.toHaveBeenCalled();
  });

  it("does not dispatch if permission or selection changes during the local lookup", async () => {
    let current = true;
    jest.mocked(listOutbox).mockImplementationOnce(async () => { current = false; return rows; });
    await expect(resolvePendingOrder("site", "local_original", () => current)).rejects.toThrow("changed");
    expect(syncPosCheckout).not.toHaveBeenCalled();
    jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("changed");
  });

  it("drops the result after permission changes during targeted synchronization", async () => {
    jest.mocked(syncPosCheckout).mockImplementation(async () => {
      rows[0].status = "synced";
      rows[0].resultOrderId = "server-order";
      jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
    });
    await expect(resolvePendingOrder("site", "local_original")).rejects.toThrow("changed");
  });
});