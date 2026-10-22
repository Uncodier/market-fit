import type { PosOutboxRow } from "@/app/pos/local/types";
import { drainPosOutbox, syncPosCheckout } from "@/app/pos/local/sync-engine";
import { checkoutCart } from "@/app/commerce/checkout";
import { reconcilePosCheckoutStatus } from "@/app/pos/actions/reconcile-checkout";
import { getPosDb } from "@/app/pos/local/db";
import { listOutbox, updateOutboxRow } from "@/app/pos/local/outbox";
import { reconcilePosCheckout } from "@/app/pos/local/checkout-recovery";

jest.mock("@/app/pos/local/location-permission-state", () => {
  const permission = (siteId: string) => ({ siteId, userId: "cashier", generation: 1 });
  return { getPosPermissionLease: permission, requirePosPermission: permission,
    isPosPermissionCurrent: () => true, subscribePosPermission: () => () => {} };
});
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/commerce/ticket-check-in", () => ({ checkInTicket: jest.fn() }));
jest.mock("@/app/pos/actions/create-lead-sync", () => ({ createLeadWithIdempotency: jest.fn() }));
jest.mock("@/app/pos/actions/sync-revision", () => ({ getPosCatalogRevision: async () => ({ data: "revision" }) }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/orders/actions", () => ({ updateOrderNotes: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: async () => ({ ok: true }) }));
jest.mock("@/app/pos/actions/reconcile-checkout", () => ({ reconcilePosCheckoutStatus: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({
  listOutbox: jest.fn(), updateOutboxRow: jest.fn(), mapLocalId: jest.fn(), getServerIdForLocal: jest.fn(),
}));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: async () => ({ ok: true }), applyPosOpenOrders: jest.fn(),
}));

function payment(id: string): PosOutboxRow {
  return { id, siteId: "site", clientMutationId: id, kind: "checkout", status: "pending", attempts: 0,
    createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z",
    payload: { kind: "checkout", data: { siteId: "site", userId: "cashier", clientMutationId: id,
      source: "pos", fulfillment: "pickup", lines: [], payments: [{ paymentId: `receipt-${id}`, method: "cash", amount: 10 }],
    } },
  };
}

it("runs targeted checkout while real recovery HTTP hangs, without putting a status action in the dispatcher", async () => {
  jest.useFakeTimers();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  const rows = [{ ...payment("old"), status: "failed" as const }, payment("target")];
  jest.mocked(listOutbox).mockImplementation(async () => rows.map((row) => ({ ...row })));
  jest.mocked(updateOutboxRow).mockImplementation(async (id, patch) => { Object.assign(rows.find((row) => row.id === id)!, patch); });
  jest.mocked(getPosDb).mockReturnValue({
    meta: { get: jest.fn() }, outbox: { get: async (id: string) => rows.find((row) => row.id === id) },
    transaction: async (_mode: string, _table: unknown, work: () => Promise<void>) => work(),
  } as unknown as ReturnType<typeof getPosDb>);
  jest.mocked(fetch).mockReturnValue(new Promise(() => {}));
  jest.mocked(checkoutCart).mockResolvedValue({
    success: true, orderId: "confirmed", saleId: "sale", publicAccessToken: "test-public-access-token",
    orderNumber: "TEST-001", status: "completed", total: 10, currency: "USD",
    createdAt: "2026-10-22T10:00:00Z", kitchenDelta: null, notes: null, fulfillment: "pickup",
  });
  try {
    const background = drainPosOutbox("site");
    for (let i = 0; i < 40; i++) await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith("/api/pos/checkout-status", expect.objectContaining({ method: "POST" }));
    await syncPosCheckout("site", "target");
    expect(rows[1]).toMatchObject({ status: "synced", resultOrderId: "confirmed" });
    expect(checkoutCart).toHaveBeenCalledTimes(1);
    expect(reconcilePosCheckoutStatus).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(8_000);
    await background;
    expect(jest.mocked(fetch).mock.calls[0][1]!.signal!.aborted).toBe(true);
    expect(rows[0].status).toBe("failed");
    expect(checkoutCart).toHaveBeenCalledTimes(1);
    expect(reconcilePosCheckoutStatus).not.toHaveBeenCalled();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

it("leaves the local payment, payload, and attempt counters untouched when a direct status read times out", async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  const row = payment("unconfirmed");
  const original = JSON.parse(JSON.stringify(row));
  jest.mocked(getPosDb).mockReturnValue({ outbox: { get: async () => row } } as unknown as ReturnType<typeof getPosDb>);
  jest.mocked(fetch).mockReturnValue(new Promise(() => {}));
  try {
    const pending = reconcilePosCheckout("site", row.id).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(8_000);
    expect(await pending).toEqual(new Error("Payment status check timed out. Keep the original operation and try again."));
    expect(row).toEqual(original);
    expect(updateOutboxRow).not.toHaveBeenCalled();
    expect(checkoutCart).not.toHaveBeenCalled();
    expect(reconcilePosCheckoutStatus).not.toHaveBeenCalled();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});