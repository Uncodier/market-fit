import type { PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn(), isPosPermissionCurrent: jest.fn(), subscribePosPermission: jest.fn(),
}));
jest.mock("@/app/pos/operation-client", () => ({ checkoutPosCart: jest.fn(), createPosLead: jest.fn() }));
jest.mock("@/app/commerce/ticket-check-in", () => ({ checkInTicket: jest.fn() }));
jest.mock("@/app/pos/catalog-revision-client", () => ({ fetchPosCatalogRevision: jest.fn() }));
jest.mock("@/app/pos/read-client", () => ({ fetchPosOpenOrders: jest.fn() }));
jest.mock("@/app/orders/actions", () => ({ updateOrderNotes: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn(), applyPosCheckoutRecovery: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({
  listOutbox: jest.fn(), updateOutboxRow: jest.fn(), mapLocalId: jest.fn(), getServerIdForLocal: jest.fn(),
}));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: jest.fn(), applyPosOpenOrders: jest.fn(),
}));

const SITE = "11111111-1111-4111-8111-111111111111";
let engine: typeof import("@/app/pos/local/sync-engine");
let checkout: jest.Mock;
let recovery: jest.Mock;
let download: jest.Mock;
let revision: jest.Mock;
let rows: PosOutboxRow[];
let meta: { lastCatalogRevision: string | null; lastPulledAt: string };
let generation: number;
let allowed: boolean;
let offlineLease: boolean;
let invalidate: () => void;

function payment(id = "target", patch: Partial<PosOutboxRow> = {}): PosOutboxRow {
  return {
    id: `row-${id}`, clientMutationId: id, kind: "checkout", siteId: SITE,
    status: "pending", attempts: 0, createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z",
    payload: { kind: "checkout", data: { siteId: SITE, userId: "cashier", source: "pos", fulfillment: "pickup",
      clientMutationId: id, lines: [], payments: [{ method: "cash", amount: 10, paymentId: `receipt-${id}` }],
      posOperationIdentity: { version: 1, deviceId: SITE, createdAt: "2026-10-22T10:00:00Z" },
    } }, ...patch,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 100; i++) await Promise.resolve(); }

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  generation = 1; allowed = true; offlineLease = false; rows = [];
  const permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
  permission.getPosPermissionLease.mockImplementation((siteId) => allowed
    ? { siteId: siteId!, userId: "cashier", role: "owner", generation, expiresAt: Infinity, offline: offlineLease } : null);
  permission.isPosPermissionCurrent.mockImplementation((lease) => allowed && lease?.generation === generation);
  permission.subscribePosPermission.mockImplementation((listener) => { invalidate = listener; return () => {}; });
  checkout = jest.mocked((await import("@/app/pos/operation-client")).checkoutPosCart);
  checkout.mockResolvedValue({ success: true, orderId: "server-order", saleId: "sale" });
  recovery = jest.mocked((await import("@/app/pos/local/checkout-recovery")).reconcilePosCheckout);
  recovery.mockResolvedValue({ state: "review_required", message: "Unknown" });
  const outbox = jest.mocked(await import("@/app/pos/local/outbox"));
  outbox.listOutbox.mockImplementation(async (siteId, statuses) => rows
    .filter((row) => row.siteId === siteId && (!statuses || statuses.includes(row.status)))
    .map((row) => ({ ...row })));
  outbox.updateOutboxRow.mockImplementation(async (id, patch) => { Object.assign(rows.find((row) => row.id === id)!, patch); });
  outbox.getServerIdForLocal.mockResolvedValue(null);
  meta = { lastCatalogRevision: "revision", lastPulledAt: new Date().toISOString() };
  jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({
    meta: { get: async () => meta }, transaction: async (_mode: unknown, _table: unknown, work: () => unknown) => work(),
    outbox: { get: async (id: string) => rows.find((row) => row.id === id) },
  } as never);
  jest.mocked((await import("@/app/pos/actions/report-sync-error")).reportPosSyncError).mockResolvedValue({ ok: true });
  jest.mocked((await import("@/app/pos/read-client")).fetchPosOpenOrders).mockResolvedValue({ data: [] });
  revision = jest.mocked((await import("@/app/pos/catalog-revision-client")).fetchPosCatalogRevision);
  revision.mockResolvedValue({ data: "revision" });
  download = jest.mocked((await import("@/app/pos/local/snapshot-pull")).pullAndStorePosCatalogSnapshot);
  download.mockImplementation(async (_site, rev) => {
    meta = { lastCatalogRevision: rev, lastPulledAt: new Date().toISOString() };
    return { ok: true, pulledAt: meta.lastPulledAt };
  });
  engine = await import("@/app/pos/local/sync-engine");
});

afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it.each(["rejected", "payment_recorded", "review_required"] as const)(
  "never forces catalog pulls for repeated unresolved %s rows", async (recoveryState) => {
    rows = [payment("target", { status: "failed", recoveryState })];
    for (let i = 0; i < 3; i++) {
      await engine.drainPosOutbox(SITE);
      await engine.syncPosCheckout(SITE, "target");
    }
    await flush();
    expect(checkout).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
  },
);

it("does not force on backoff, missing dependencies, missing rows or historical confirmations", async () => {
  const dependency = payment("dependency");
  if (dependency.payload.kind === "checkout") dependency.payload.data.localLeadId = "local_missing";
  rows = [payment("backoff", { status: "failed", checkoutRetryAfter: Date.now() + 300_000 }),
    dependency, payment("historical", { status: "synced" })];
  await engine.drainPosOutbox(SITE);
  await engine.syncPosCheckout(SITE, "missing");
  await engine.syncPosCheckout(SITE, "historical");
  await flush();
  expect(download).not.toHaveBeenCalled();
  expect(checkout).not.toHaveBeenCalled();
});

it.each(["targeted", "drain"])("refreshes a newly confirmed %s checkout once without changing its identity", async (mode) => {
  rows = [payment()];
  const payload = JSON.parse(JSON.stringify(rows[0].payload));
  if (mode === "targeted") await engine.syncPosCheckout(SITE, "target");
  else await engine.drainPosOutbox(SITE);
  await flush();
  await engine.syncPosCheckout(SITE, "target");
  await engine.drainPosOutbox(SITE);
  await engine.refreshPosSyncCounts(SITE);
  expect(rows[0].status).toBe("synced");
  expect(rows[0].payload).toEqual(payload);
  expect(checkout).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledWith(SITE, "revision", true, expect.any(Function));
});

it("refreshes late success after the real worker timeout, never on timeout or a duplicate waiter", async () => {
  rows = [payment()];
  const request = deferred<{ success: boolean; orderId: string }>();
  checkout.mockReturnValueOnce(request.promise);
  const wait = engine.syncPosCheckout(SITE, "target");
  await jest.advanceTimersByTimeAsync(45_000);
  await wait;
  await engine.drainPosOutbox(SITE);
  expect(download).not.toHaveBeenCalled();
  expect(checkout).toHaveBeenCalledTimes(1);
  request.resolve({ success: true, orderId: "late-order" });
  await flush();
  expect(rows[0].status).toBe("synced");
  expect(download).toHaveBeenCalledTimes(1);
});

it("detects completed recovery only after it is persisted", async () => {
  rows = [payment("target", { status: "failed" })];
  recovery.mockImplementationOnce(async () => {
    rows[0] = { ...rows[0], status: "synced" };
    return { state: "completed" };
  });
  await engine.syncPosCheckout(SITE, "target");
  await flush();
  expect(checkout).not.toHaveBeenCalled();
  expect(download).toHaveBeenCalledTimes(1);
});

it("queues a second full pull when checkout confirms during an active catalog download", async () => {
  const first = deferred<{ ok: boolean }>();
  download.mockReturnValueOnce(first.promise);
  const pull = engine.pullPosCatalogInBackground(SITE, true);
  await flush();
  rows = [payment()];
  await engine.syncPosCheckout(SITE, "target");
  await flush();
  expect(download).toHaveBeenCalledTimes(1);
  first.resolve({ ok: true });
  await pull; await flush();
  expect(download).toHaveBeenCalledTimes(2);
  await engine.runPosSyncCycle(SITE);
  expect(download).toHaveBeenCalledTimes(2);
});

it("retains a force request made while an unchanged revision check is active", async () => {
  const checking = deferred<{ data: string }>();
  revision.mockReturnValueOnce(checking.promise);
  const pull = engine.pullPosCatalogInBackground(SITE);
  await flush();
  await engine.pullPosCatalogInBackground(SITE, true);
  checking.resolve({ data: "revision" });
  await pull; await flush();
  expect(download).toHaveBeenCalledTimes(1);
  expect(download.mock.calls[0][2]).toBe(true);
});

it("retains checkout refresh through offline permission suspension and resumes only with remote access", async () => {
  rows = [payment()];
  await engine.refreshPosSyncCounts(SITE);
  offlineLease = true;
  rows[0].status = "synced";
  await engine.refreshPosSyncCounts(SITE);
  allowed = false; generation++; invalidate();
  await engine.runPosSyncCycle(SITE, true);
  expect(download).not.toHaveBeenCalled();
  allowed = true; offlineLease = false;
  await engine.runPosSyncCycle(SITE);
  await flush();
  expect(download).toHaveBeenCalledTimes(1);
});

it("does not refresh or publish a stale worker response after actor-generation invalidation", async () => {
  rows = [payment()];
  const request = deferred<{ success: boolean; orderId: string }>();
  checkout.mockReturnValueOnce(request.promise);
  const wait = engine.syncPosCheckout(SITE, "target");
  await flush();
  generation++; invalidate();
  request.resolve({ success: true, orderId: "stale" });
  await wait; await flush();
  expect(rows[0].status).not.toBe("synced");
  expect(download).not.toHaveBeenCalled();
});

it("cools failed catalog downloads independently of checkout and retains refresh intent", async () => {
  download.mockResolvedValueOnce({ ok: false, error: "Catalog unavailable" });
  await engine.pullPosCatalogInBackground(SITE, true);
  rows = [payment()];
  await engine.syncPosCheckout(SITE, "target");
  await engine.runPosSyncCycle(SITE, true, true);
  await engine.pullPosCatalogInBackground(SITE, true);
  expect(rows[0].status).toBe("synced");
  expect(download).toHaveBeenCalledTimes(1);
  expect(engine.getPosSyncStatus(SITE).lastError).toBe("Catalog unavailable");
  await jest.advanceTimersByTimeAsync(30_000);
  await engine.runPosSyncCycle(SITE);
  await flush();
  expect(download).toHaveBeenCalledTimes(2);
  expect(download.mock.calls[1][2]).toBe(true);
  expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
});

it("backs off repeated failures, resets on success and does not extend snapshot freshness", async () => {
  download.mockRejectedValueOnce(new Error("Unavailable"));
  await engine.pullPosCatalogInBackground(SITE, true);
  await jest.advanceTimersByTimeAsync(30_000);
  download.mockResolvedValueOnce({ ok: false });
  await engine.pullPosCatalogInBackground(SITE);
  await jest.advanceTimersByTimeAsync(30_000);
  await engine.pullPosCatalogInBackground(SITE, true);
  expect(download).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(30_000);
  await engine.pullPosCatalogInBackground(SITE);
  expect(download).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(300_000);
  await engine.runPosSyncCycle(SITE);
  expect(download).toHaveBeenCalledTimes(4);
});