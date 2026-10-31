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

it("publishes accepted access and resumes an active cycle immediately without clearing sync history", async () => {
  const { notifyPosAccessUpdated } = await import("@/app/pos/local/access-recheck");
  await engine.pullPosCatalogInBackground(SITE, true);
  const completed = engine.getPosSyncStatus(SITE);
  permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation, expiresAt: Infinity, offline: true });
  engine.startPosSyncLoop(SITE);
  await flush();
  jest.mocked(fetch).mockClear();
  download.mockClear();
  const orders = jest.mocked((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders);
  orders.mockClear();
  const listener = jest.fn();
  const unsubscribe = engine.subscribePosSync(listener, SITE);

  // A notification alone cannot authorize replay under the cached lease.
  notifyPosAccessUpdated();
  await flush();
  expect(listener.mock.lastCall?.[0].accessVerified).toBe(false);
  expect(orders).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();

  permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation, expiresAt: Date.now() + 60_000 });
  notifyPosAccessUpdated();
  expect(listener.mock.lastCall?.[0]).toMatchObject({ online: true, accessVerified: true,
    lastPulledAt: completed.lastPulledAt, catalogSync: completed.catalogSync });
  await flush();
  expect(orders).toHaveBeenCalledTimes(1);
  // Successful renewal does not reset catalog scheduling or force a new download.
  expect(fetch).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
  expect(engine.getPosSyncStatus(SITE).catalogSync).toEqual(completed.catalogSync);
  unsubscribe();
});

it("updates inactive diagnostics without starting remote work, and rejects missing grants", async () => {
  const { notifyPosAccessUpdated } = await import("@/app/pos/local/access-recheck");
  engine.startPosSyncLoop(SITE);
  await flush();
  engine.stopPosSyncLoop(SITE);
  jest.mocked(fetch).mockClear();
  const orders = jest.mocked((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders);
  orders.mockClear();
  const listener = jest.fn();
  const unsubscribe = engine.subscribePosSync(listener, SITE);
  notifyPosAccessUpdated();
  expect(listener.mock.lastCall?.[0].accessVerified).toBe(true);
  allowed = false;
  notifyPosAccessUpdated();
  expect(listener.mock.lastCall?.[0].accessVerified).toBe(false);
  await flush();
  expect(fetch).not.toHaveBeenCalled();
  expect(orders).not.toHaveBeenCalled();
  unsubscribe();
});

it("separates connectivity from cached-lease access without enabling any remote lane", async () => {
  permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation, expiresAt: Infinity, offline: true });
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ online: false, networkOnline: true, accessVerified: false });
  await engine.runPosSyncCycle(SITE, true);
  await engine.drainPosOutbox(SITE);
  await engine.syncPosCheckout(SITE, "checkout");
  expect(fetch).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
  expect((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders).not.toHaveBeenCalled();
  expect((await import("@/app/pos/local/sync-outbox-worker")).syncPosOutboxRow).not.toHaveBeenCalled();

  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ online: false, networkOnline: false, accessVerified: false });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation, expiresAt: Date.now() + 60_000 });
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ online: true, networkOnline: true, accessVerified: true });
  await engine.runPosSyncCycle(SITE, true);
  expect(fetch).toHaveBeenCalled();
});

it("keeps missing access fail-closed while reporting browser connectivity", () => {
  allowed = false;
  expect(engine.getPosSyncStatus(SITE)).toMatchObject({ online: false, networkOnline: true, accessVerified: false });
});

it("publishes reconnection while an unmounted cached workspace still awaits verification", async () => {
  permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation, expiresAt: Infinity, offline: true });
  engine.startPosSyncLoop(SITE);
  await flush();
  engine.stopPosSyncLoop(SITE);
  const listener = jest.fn();
  const unsubscribe = engine.subscribePosSync(listener, SITE);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  window.dispatchEvent(new Event("offline"));
  expect(listener.mock.lastCall?.[0]).toMatchObject({ networkOnline: false });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
  expect(listener.mock.lastCall?.[0]).toMatchObject({ online: false, networkOnline: true, accessVerified: false });
  expect(fetch).not.toHaveBeenCalled();
  unsubscribe();
});

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