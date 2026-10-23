jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn(), isPosPermissionCurrent: jest.fn(), subscribePosPermission: jest.fn(),
}));
jest.mock("@/app/pos/local/sync-outbox-worker", () => ({ hasPosOutboxWork: () => false, syncPosOutboxRow: jest.fn() }));
jest.mock("@/app/pos/actions/sync-revision", () => ({ getPosCatalogRevision: jest.fn() }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: jest.fn(), applyPosOpenOrders: jest.fn(),
}));

const SITE = "11111111-1111-4111-8111-111111111111";
let engine: typeof import("@/app/pos/local/sync-engine");
let permission: jest.Mocked<typeof import("@/app/pos/local/location-permission-state")>;
let download: jest.Mock;
let meta: { lastCatalogRevision: string | null; lastPulledAt: string };
let generation: number;
let allowed: boolean;
let invalidate: () => void;

const response = (data = "revision") => ({ ok: true, headers: { get: () => "application/json" }, json: async () => ({ data }) }) as unknown as Response;
async function flush() { for (let i = 0; i < 60; i++) await Promise.resolve(); }

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  generation = 1;
  allowed = true;
  permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
  permission.getPosPermissionLease.mockImplementation((siteId) => allowed && navigator.onLine
    ? { siteId: siteId!, userId: "cashier", role: "owner", generation, expiresAt: Date.now() + 60_000 } : null);
  permission.isPosPermissionCurrent.mockImplementation((lease) => allowed && navigator.onLine && lease?.generation === generation);
  permission.subscribePosPermission.mockImplementation((listener) => { invalidate = listener; return () => {}; });
  meta = { lastCatalogRevision: "revision", lastPulledAt: new Date().toISOString() };
  jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({ meta: { get: async () => meta } } as never);
  jest.mocked((await import("@/app/pos/local/outbox")).listOutbox).mockResolvedValue([]);
  jest.mocked((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders).mockResolvedValue({ data: [] });
  jest.mocked((await import("@/app/pos/actions/report-sync-error")).reportPosSyncError).mockResolvedValue({ ok: true });
  download = jest.mocked((await import("@/app/pos/local/snapshot-pull")).pullAndStorePosCatalogSnapshot);
  download.mockImplementation(async (_site, revision) => {
    meta = { lastCatalogRevision: revision, lastPulledAt: new Date().toISOString() };
    return { ok: true, pulledAt: meta.lastPulledAt };
  });
  jest.mocked(fetch).mockReset().mockResolvedValue(response());
  engine = await import("@/app/pos/local/sync-engine");
});

afterEach(() => { engine.stopPosSyncLoop(SITE); jest.clearAllTimers(); jest.useRealTimers(); });

it("downloads after a hanging HTTP revision deadline without entering the Server Action queue", async () => {
  let late!: (value: Response) => void;
  jest.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { late = resolve; }));
  const pull = engine.pullPosCatalogInBackground(SITE, true);
  await flush();
  expect(download).not.toHaveBeenCalled();
  const { CATALOG_REVISION_WAIT_MS } = await import("@/app/pos/catalog-revision-client");
  await jest.advanceTimersByTimeAsync(CATALOG_REVISION_WAIT_MS);
  await pull;
  expect(download).toHaveBeenCalledWith(SITE, null, true, expect.any(Function));
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect((await import("@/app/pos/actions/sync-revision")).getPosCatalogRevision).not.toHaveBeenCalled();
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ pulling: false, lastError: null });
  await engine.pullPosCatalogInBackground(SITE, true);
  late(response("obsolete-revision"));
  await flush();
  expect(download).toHaveBeenCalledTimes(2);
  expect(meta.lastCatalogRevision).toBe("revision");
});

it("retains recovery intent through offline unmount, online event and delayed permission verification", async () => {
  engine.startPosSyncLoop(SITE);
  await flush();
  expect(download).not.toHaveBeenCalled();
  allowed = false;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  invalidate();
  engine.stopPosSyncLoop(SITE);
  window.dispatchEvent(new Event("offline"));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(download).not.toHaveBeenCalled();
  allowed = true; generation++;
  engine.startPosSyncLoop(SITE);
  await flush();
  expect(download).toHaveBeenCalledWith(SITE, "revision", true, expect.any(Function));
  await jest.advanceTimersByTimeAsync(30_000);
  expect(download).toHaveBeenCalledTimes(1);
});

it("keeps reconnection recovery pending after a failed download", async () => {
  engine.startPosSyncLoop(SITE);
  await flush();
  window.dispatchEvent(new Event("offline"));
  download.mockResolvedValueOnce({ ok: false, error: "Unavailable" });
  await engine.runPosSyncCycle(SITE);
  expect(engine.getPosSyncStatus(SITE).catalogSync?.error).toBe(true);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(download).toHaveBeenCalledTimes(2);
  expect(engine.getPosSyncStatus(SITE).catalogSync?.error).toBe(false);
});

it("does not consume a newer disconnect's recovery intent when an older pull finishes", async () => {
  engine.startPosSyncLoop(SITE);
  await flush();
  window.dispatchEvent(new Event("offline"));
  let finish!: (value: { ok: boolean; pulledAt: string }) => void;
  download.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = engine.runPosSyncCycle(SITE);
  await flush();
  window.dispatchEvent(new Event("offline"));
  meta = { lastCatalogRevision: "revision", lastPulledAt: new Date().toISOString() };
  finish({ ok: true, pulledAt: meta.lastPulledAt });
  await first;
  await engine.runPosSyncCycle(SITE);
  expect(download).toHaveBeenCalledTimes(2);
});

it("notifies the subscribed widget immediately when same-site access expires", async () => {
  const listener = jest.fn();
  const unsubscribe = engine.subscribePosSync(listener, SITE);
  await engine.pullPosCatalogInBackground(SITE, true);
  expect(listener.mock.lastCall?.[0].catalogSync.lastSuccess).not.toBeNull();
  allowed = false; generation++;
  invalidate();
  expect(listener.mock.lastCall?.[0]).toMatchObject({ accessVerified: false, pulling: false, lastPulledAt: null, lastError: null });
  expect(listener.mock.lastCall?.[0].catalogSync).toBeUndefined();
  unsubscribe();
});

it("does not publish or store late success after permission invalidation", async () => {
  let late!: (value: Response) => void;
  jest.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { late = resolve; }));
  const listener = jest.fn();
  const unsubscribe = engine.subscribePosSync(listener, SITE);
  const pull = engine.pullPosCatalogInBackground(SITE, true);
  await flush();
  allowed = false; generation++;
  invalidate();
  late(response());
  await pull;
  expect(download).not.toHaveBeenCalled();
  expect(listener.mock.lastCall?.[0].accessVerified).toBe(false);
  expect(engine.getPosSyncStatus(SITE).catalogSync).toBeUndefined();
  unsubscribe();
});