import type { PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn(), isPosPermissionCurrent: jest.fn(), subscribePosPermission: jest.fn(),
}));
jest.mock("@/app/pos/local/sync-outbox-item", () => ({ applyOutboxItem: jest.fn() }));
jest.mock("@/app/pos/catalog-revision-client", () => ({ fetchPosCatalogRevision: jest.fn() }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn(), updateOutboxRow: jest.fn() }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: jest.fn(), applyPosOpenOrders: jest.fn(),
}));

const SITE = "site-one";
const OTHER_SITE = "site-two";
let engine: typeof import("@/app/pos/local/sync-engine");
let orders: jest.Mock;
let apply: jest.Mock;
let catalog: jest.Mock;
let permission: jest.Mocked<typeof import("@/app/pos/local/location-permission-state")>;
let invalidate: () => void;
let generation: number;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  generation = 1;
  permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
  permission.getPosPermissionLease.mockImplementation((siteId) => ({
    siteId: siteId!, userId: "cashier", role: "owner", generation, expiresAt: Date.now() + 60_000,
  }));
  permission.isPosPermissionCurrent.mockImplementation((lease) => lease?.generation === generation);
  permission.subscribePosPermission.mockImplementation((listener) => { invalidate = listener; return () => {}; });
  orders = jest.mocked((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders);
  orders.mockResolvedValue({ data: [] });
  const snapshot = await import("@/app/pos/local/snapshot-pull");
  apply = jest.mocked(snapshot.applyPosOpenOrders);
  apply.mockResolvedValue(undefined);
  catalog = jest.mocked(snapshot.pullAndStorePosCatalogSnapshot);
  catalog.mockResolvedValue({ ok: true });
  jest.mocked((await import("@/app/pos/catalog-revision-client")).fetchPosCatalogRevision).mockResolvedValue({ data: "revision" });
  jest.mocked((await import("@/app/pos/actions/report-sync-error")).reportPosSyncError).mockResolvedValue({ ok: true });
  jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({
    meta: { get: jest.fn(async () => undefined) },
  } as unknown as ReturnType<typeof import("@/app/pos/local/db").getPosDb>);
  jest.mocked((await import("@/app/pos/local/outbox")).listOutbox).mockResolvedValue([]);
  engine = await import("@/app/pos/local/sync-engine");
});

afterEach(() => {
  engine.stopPosSyncLoop(SITE);
  engine.stopPosSyncLoop(OTHER_SITE);
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("shares the exact per-site promise through remote read and local application, without blocking another site", async () => {
  const read = deferred<{ data: [] }>();
  const storing = deferred<void>();
  orders.mockReturnValueOnce(read.promise);
  apply.mockImplementation((siteId: string) => siteId === SITE ? storing.promise : Promise.resolve());
  const first = engine.pullPosOrdersInBackground(SITE);
  expect(engine.pullPosOrdersInBackground(SITE)).toBe(first);
  await engine.pullPosOrdersInBackground(OTHER_SITE);
  expect(orders.mock.calls).toEqual([[SITE], [OTHER_SITE]]);
  read.resolve({ data: [] });
  await flush();
  expect(engine.pullPosOrdersInBackground(SITE)).toBe(first);
  expect(orders).toHaveBeenCalledTimes(2);
  storing.resolve();
  await first;
  await engine.pullPosOrdersInBackground(SITE);
  expect(orders).toHaveBeenCalledTimes(3);
});

it("does not release a hanging request on interval, force, visibility, or loop restart", async () => {
  const read = deferred<{ data: [] }>();
  orders.mockReturnValueOnce(read.promise);
  engine.startPosSyncLoop(SITE);
  await flush();
  await jest.advanceTimersByTimeAsync(10 * 60_000);
  const forced = engine.runPosSyncCycle(SITE, true);
  document.dispatchEvent(new Event("visibilitychange"));
  engine.stopPosSyncLoop(SITE);
  engine.startPosSyncLoop(SITE);
  await flush();
  expect(orders).toHaveBeenCalledTimes(1);
  expect(catalog.mock.calls.length).toBeGreaterThan(1);
  read.resolve({ data: [] });
  await forced;
  await flush();
  await jest.advanceTimersByTimeAsync(30_000);
  expect(orders).toHaveBeenCalledTimes(2);
});

it.each(["returned", "thrown", "local"])("backs off %s failures, preserves the last success, and caps retries even for force/visibility", async (kind) => {
  await engine.pullPosOrdersInBackground(SITE);
  const lastSuccess = engine.getPosSyncStatus(SITE).lastOrdersPulledAt;
  if (kind === "returned") orders.mockResolvedValue({ error: "Unavailable" });
  if (kind === "thrown") orders.mockRejectedValue(new Error("Unavailable"));
  if (kind === "local") apply.mockRejectedValue(new Error("Unavailable"));
  for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
    await engine.pullPosOrdersInBackground(SITE);
    const count = orders.mock.calls.length;
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ lastOrdersPulledAt: lastSuccess, lastError: "Unavailable" });
    await jest.advanceTimersByTimeAsync(delay - 1);
    await engine.pullPosOrdersInBackground(SITE);
    await engine.runPosSyncCycle(SITE, true);
    await engine.runPosSyncCycle(SITE, false, true);
    expect(orders).toHaveBeenCalledTimes(count);
    await jest.advanceTimersByTimeAsync(1);
  }
});

it("resets exponential delay and the error on success", async () => {
  orders.mockResolvedValue({ error: "Unavailable" });
  await engine.pullPosOrdersInBackground(SITE);
  await jest.advanceTimersByTimeAsync(30_000);
  await engine.pullPosOrdersInBackground(SITE);
  await jest.advanceTimersByTimeAsync(60_000);
  orders.mockResolvedValueOnce({ data: [] });
  await engine.pullPosOrdersInBackground(SITE);
  expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  await engine.pullPosOrdersInBackground(SITE);
  const count = orders.mock.calls.length;
  await jest.advanceTimersByTimeAsync(29_999);
  await engine.pullPosOrdersInBackground(SITE);
  expect(orders).toHaveBeenCalledTimes(count);
  await jest.advanceTimersByTimeAsync(1);
  await engine.pullPosOrdersInBackground(SITE);
  expect(orders).toHaveBeenCalledTimes(count + 1);
});

it("isolates failure cooldowns between sites", async () => {
  orders.mockResolvedValueOnce({ error: "Unavailable" });
  await engine.pullPosOrdersInBackground(SITE);
  await engine.pullPosOrdersInBackground(OTHER_SITE);
  await engine.pullPosOrdersInBackground(SITE);
  expect(orders.mock.calls).toEqual([[SITE], [OTHER_SITE]]);
  expect(engine.getPosSyncStatus(OTHER_SITE).lastError).toBeNull();
});

it.each([false, true])("resets scheduling on invalidation but retains the old slot until late settlement (reject=%s)", async (reject) => {
  orders.mockResolvedValueOnce({ error: "Old failure" });
  await engine.pullPosOrdersInBackground(SITE);
  await jest.advanceTimersByTimeAsync(30_000);
  const read = deferred<{ data: [] }>();
  orders.mockReturnValueOnce(read.promise);
  const old = engine.pullPosOrdersInBackground(SITE);
  await flush();
  generation++;
  invalidate();
  expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  expect(engine.pullPosOrdersInBackground(SITE)).toBe(old);
  await jest.advanceTimersByTimeAsync(10 * 60_000);
  expect(orders).toHaveBeenCalledTimes(2);
  if (reject) read.reject(new Error("Late failure"));
  else read.resolve({ data: [] });
  await old;
  expect(apply).not.toHaveBeenCalled();
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ lastError: null, lastOrdersPulledAt: null });
  orders.mockResolvedValue({ error: "New failure" });
  await engine.pullPosOrdersInBackground(SITE);
  await jest.advanceTimersByTimeAsync(30_000);
  await engine.pullPosOrdersInBackground(SITE);
  expect(orders).toHaveBeenCalledTimes(4);
});

it("does not mark local application successful after its lease is invalidated", async () => {
  const storing = deferred<void>();
  apply.mockReturnValueOnce(storing.promise);
  const request = engine.pullPosOrdersInBackground(SITE);
  await flush();
  generation++;
  invalidate();
  storing.resolve();
  await request;
  expect(engine.getPosSyncStatus(SITE).lastOrdersPulledAt).toBeNull();
});

it("allows outbox replay while both catalog and orders requests are hanging", async () => {
  const read = deferred<{ data: [] }>();
  const snapshot = deferred<{ ok: boolean }>();
  orders.mockReturnValueOnce(read.promise);
  catalog.mockReturnValueOnce(snapshot.promise);
  const row: PosOutboxRow = {
    id: "operation", clientMutationId: "operation", kind: "check_in", siteId: SITE, status: "pending", attempts: 0,
    createdAt: "2026-10-21T12:00:00Z", updatedAt: "2026-10-21T12:00:00Z",
    payload: { kind: "check_in", data: { siteId: SITE, clientMutationId: "operation", code: "ticket" } },
  };
  const db = (await import("@/app/pos/local/db")).getPosDb();
  Object.assign(db, { outbox: { get: jest.fn(async () => row) },
    transaction: jest.fn(async (_mode, _table, work) => work()),
  });
  const outbox = jest.mocked(await import("@/app/pos/local/outbox"));
  outbox.listOutbox.mockImplementation(async () => row.status === "synced" ? [] : [row]);
  outbox.updateOutboxRow.mockResolvedValue(undefined);
  const replay = jest.mocked((await import("@/app/pos/local/sync-outbox-item")).applyOutboxItem);
  replay.mockImplementation(async () => { row.status = "synced"; });
  const cycle = engine.runPosSyncCycle(SITE);
  await flush();
  expect(replay).toHaveBeenCalledTimes(1);
  expect(engine.getPosSyncStatus(SITE).pendingCount).toBe(0);
  read.resolve({ data: [] });
  snapshot.resolve({ ok: true });
  await cycle;
});

it.each(["hidden", "offline", "no-lease"])("does not start remote pulls when %s", async (condition) => {
  if (condition === "hidden") Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  if (condition === "offline") Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  if (condition === "no-lease") permission.getPosPermissionLease.mockReturnValue(null);
  await engine.pullPosOrdersInBackground(SITE);
  await engine.runPosSyncCycle(SITE, true, true);
  expect(orders).not.toHaveBeenCalled();
});

it("rechecks visibility after the asynchronous queue read before launching sync lanes", async () => {
  const counts = deferred<PosOutboxRow[]>();
  jest.mocked((await import("@/app/pos/local/outbox")).listOutbox).mockReturnValueOnce(counts.promise);
  const cycle = engine.runPosSyncCycle(SITE, true);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  counts.resolve([]);
  await cycle;
  expect(orders).not.toHaveBeenCalled();
  expect(catalog).not.toHaveBeenCalled();
});