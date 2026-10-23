import type { PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn((siteId: string) => ({ siteId, userId: "cashier", generation: 1 })),
  isPosPermissionCurrent: jest.fn(() => true),
  subscribePosPermission: () => () => {},
}));

jest.mock("@/app/pos/operation-client", () => ({ checkoutPosCart: jest.fn(), createPosLead: jest.fn() }));
jest.mock("@/app/commerce/ticket-check-in", () => ({ checkInTicket: jest.fn() }));
jest.mock("@/app/pos/catalog-revision-client", () => ({ fetchPosCatalogRevision: jest.fn() }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/orders/actions", () => ({ updateOrderNotes: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn(), applyPosCheckoutRecovery: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({
  listOutbox: jest.fn(), updateOutboxRow: jest.fn(),
  mapLocalId: jest.fn(), getServerIdForLocal: jest.fn(),
}));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: jest.fn(), applyPosOpenOrders: jest.fn(),
}));

const SITE = "11111111-1111-4111-8111-111111111111";
let engine: typeof import("@/app/pos/local/sync-engine");
let checkIn: jest.Mock;
let report: jest.Mock;
let catalogPull: jest.Mock;
let revision: jest.Mock;
let ordersPull: jest.Mock;
let applyOrders: jest.Mock;
let listOutbox: jest.Mock;
let metaGet: jest.Mock;
let rows: PosOutboxRow[];

function queued(id = "mutation-1"): PosOutboxRow {
  return {
    id, siteId: SITE, kind: "check_in", clientMutationId: id,
    payload: { kind: "check_in", data: { siteId: SITE, code: "ticket-code", clientMutationId: id } },
    status: "pending", attempts: 0, lastError: null,
    createdAt: "2026-10-16T10:00:00.000Z", updatedAt: "2026-10-16T10:00:00.000Z",
  };
}

async function settleReporting() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("POS sync failure reporting and recovery", () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    rows = [];
    checkIn = jest.mocked((await import("@/app/commerce/ticket-check-in")).checkInTicket);
    report = jest.mocked((await import("@/app/pos/actions/report-sync-error")).reportPosSyncError);
    const snapshot = await import("@/app/pos/local/snapshot-pull");
    catalogPull = jest.mocked(snapshot.pullAndStorePosCatalogSnapshot);
    applyOrders = jest.mocked(snapshot.applyPosOpenOrders);
    revision = jest.mocked((await import("@/app/pos/catalog-revision-client")).fetchPosCatalogRevision);
    ordersPull = jest.mocked((await import("@/app/pos/actions/list-open-orders")).listPosOpenOrders);
    const outbox = jest.mocked(await import("@/app/pos/local/outbox"));
    listOutbox = outbox.listOutbox;
    listOutbox.mockImplementation(async (siteId: string, statuses?: string[]) => rows
      .filter((row) => row.siteId === siteId && (!statuses || statuses.includes(row.status)))
      .map((row) => ({ ...row })));
    outbox.updateOutboxRow.mockImplementation(async (id: string, patch: Partial<PosOutboxRow>) => {
      Object.assign(rows.find((row) => row.id === id)!, patch);
    });
    metaGet = jest.fn(async () => undefined);
    jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({
      meta: { get: metaGet },
      outbox: { get: jest.fn(async (id: string) => rows.find((row) => row.id === id)) },
      transaction: jest.fn(async (_mode: string, _table: unknown, work: () => Promise<void>) => work()),
    } as unknown as ReturnType<typeof import("@/app/pos/local/db").getPosDb>);
    checkIn.mockResolvedValue({ success: true });
    report.mockResolvedValue({ ok: true });
    catalogPull.mockResolvedValue({ ok: true, pulledAt: "2026-10-16T10:00:00.000Z" });
    revision.mockResolvedValue({ data: "revision-1" });
    ordersPull.mockResolvedValue({ data: [], error: null });
    applyOrders.mockResolvedValue(undefined);
    engine = await import("@/app/pos/local/sync-engine");
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("reports an operation failure without emailing its payload and clears it after retry succeeds", async () => {
    rows = [queued()];
    checkIn.mockResolvedValueOnce({ error: "Ticket sync failed" });
    await engine.drainPosOutbox(SITE);
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "Ticket sync failed", attempts: 1 });
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ failedCount: 1, lastError: "Ticket sync failed", syncing: false });
    expect(report).toHaveBeenCalledWith({
      siteId: SITE, operation: "check_in", error: "Ticket sync failed",
      clientMutationId: "mutation-1", attempts: 1,
    });
    expect(JSON.stringify(report.mock.calls)).not.toContain("ticket-code");

    await engine.drainPosOutbox(SITE);
    expect(rows[0]).toMatchObject({ status: "synced", lastError: null, attempts: 2 });
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ pendingCount: 0, failedCount: 0, lastError: null });
    expect(report).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not replay the next queued operation or record a late result after revocation", async () => {
    rows = [queued("first"), queued("second")];
    let finish!: (value: { success: boolean }) => void;
    checkIn.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const draining = engine.drainPosOutbox(SITE);
    for (let i = 0; i < 40 && !finish; i++) await Promise.resolve();
    const permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
    permission.isPosPermissionCurrent.mockReturnValue(false);
    finish({ success: true });
    await draining;
    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe("syncing");
    expect(rows[1].status).toBe("pending");
    expect(report).not.toHaveBeenCalled();
  });

  it("does not apply old-site open orders after an actor/scope transition", async () => {
    let finish!: (value: { data: { id: string }[] }) => void;
    ordersPull.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pulling = engine.pullPosOrdersInBackground(SITE);
    await Promise.resolve();
    const permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
    permission.isPosPermissionCurrent.mockReturnValue(false);
    finish({ data: [{ id: "old-private-order" }] });
    await pulling;
    expect(applyOrders).not.toHaveBeenCalled();
  });

  it("rejects forged outbox site scope before any server call", async () => {
    const row = queued();
    row.payload.data.siteId = "another-site";
    rows = [row];
    await engine.drainPosOutbox(SITE);
    expect(checkIn).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "POS site changed" });
  });

  it("never replays a checkout attributed to a different cached actor", async () => {
    rows = [{ ...queued(), kind: "checkout", payload: { kind: "checkout", data: {
      siteId: SITE, userId: "previous-actor", clientMutationId: "mutation-1",
      lines: [], fulfillment: "dine_in", source: "pos",
    } } }];
    await engine.drainPosOutbox(SITE);
    const checkout = jest.mocked((await import("@/app/pos/operation-client")).checkoutPosCart);
    expect(checkout).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "POS account changed" });
  });

  it("checks failed collected-payment status without replaying checkout or blocking unrelated work", async () => {
    rows = [{ ...queued("payment"), status: "failed", kind: "checkout", payload: { kind: "checkout", data: {
      siteId: SITE, userId: "cashier", clientMutationId: "payment", source: "pos", fulfillment: "pickup",
      lines: [], payments: [{ method: "cash", amount: 100, paymentId: "original-receipt" }],
    } } }, queued("independent")];
    const recovery = jest.mocked((await import("@/app/pos/local/checkout-recovery")).reconcilePosCheckout);
    recovery.mockResolvedValue({ state: "payment_recorded", message: "Review finalization" });
    await engine.drainPosOutbox(SITE);
    expect(recovery).toHaveBeenCalledWith(SITE, "payment");
    expect((await import("@/app/pos/operation-client")).checkoutPosCart).not.toHaveBeenCalled();
    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(rows[1].status).toBe("synced");
    expect(rows[0].payload.kind === "checkout" && rows[0].payload.data.payments?.[0].paymentId).toBe("original-receipt");
  });

  it("does not replay recovered rejected or recorded operations on manual drain", async () => {
    rows = ["rejected", "payment_recorded"].map((recoveryState, index) => ({ ...queued(`payment-${index}`),
      status: "failed", recoveryState, kind: "checkout", payload: { kind: "checkout", data: {
        siteId: SITE, userId: "cashier", clientMutationId: `payment-${index}`, source: "pos", fulfillment: "pickup",
        lines: [], payments: [{ method: "cash", amount: 100, paymentId: "receipt" }],
      } },
    })) as PosOutboxRow[];
    jest.mocked((await import("@/app/pos/local/checkout-recovery")).reconcilePosCheckout)
      .mockResolvedValue({ state: "payment_recorded", message: "Review finalization" });
    await engine.drainPosOutbox(SITE);
    expect((await import("@/app/pos/operation-client")).checkoutPosCart).not.toHaveBeenCalled();
    expect(rows.every((row) => row.status === "failed")).toBe(true);
    expect(rows.every((row) => row.attempts === 0)).toBe(true);
  });

  it("automatically retries a persisted failed row without pending rows or a manual force", async () => {
    rows = [{ ...queued(), status: "failed", lastError: "Old failure", attempts: 2 }];
    await engine.runPosSyncCycle(SITE);
    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({ status: "synced", lastError: null, attempts: 3 });
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ failedCount: 0, lastError: null });
  });

  it("does not hide an unresolved failure when another operation or catalog pull succeeds", async () => {
    rows = [queued("failed-row"), queued("successful-row")];
    checkIn.mockResolvedValueOnce({ error: "Ticket sync failed" });
    await engine.drainPosOutbox(SITE);
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ failedCount: 1, lastError: "Ticket sync failed" });
    await engine.drainPosOutbox(SITE);
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ failedCount: 0, lastError: null });
  });

  it("deduplicates a repeated error, but reports a new incident after successful recovery", async () => {
    rows = [queued()];
    checkIn.mockResolvedValue({ error: "Ticket sync failed" });
    await engine.drainPosOutbox(SITE);
    await settleReporting();
    await engine.drainPosOutbox(SITE);
    expect(report).toHaveBeenCalledTimes(1);
    checkIn.mockResolvedValue({ success: true });
    await engine.drainPosOutbox(SITE);
    rows.push(queued("new-mutation"));
    checkIn.mockResolvedValue({ error: "Ticket sync failed" });
    await engine.drainPosOutbox(SITE);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("retries a notification after its send fails and never blocks sync on an email", async () => {
    rows = [queued()];
    checkIn.mockResolvedValue({ error: "Ticket sync failed" });
    report.mockRejectedValueOnce(new Error("Email unavailable"));
    await engine.drainPosOutbox(SITE);
    await settleReporting();
    report.mockImplementation(() => new Promise(() => {}));
    await engine.drainPosOutbox(SITE);
    expect(report).toHaveBeenCalledTimes(2);
    checkIn.mockResolvedValue({ success: true });
    await engine.drainPosOutbox(SITE);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("reports timeout, retains the active slot, and restores status on late success", async () => {
    rows = [queued()];
    let finish!: (value: { success: boolean }) => void;
    checkIn.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const drain = engine.drainPosOutbox(SITE);
    await jest.advanceTimersByTimeAsync(45_000);
    await drain;
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "Sync timed out" });
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ error: "Sync timed out" }));
    await engine.drainPosOutbox(SITE);
    expect(checkIn).toHaveBeenCalledTimes(1);
    finish({ success: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ failedCount: 0, lastError: null });
  });

  it("reports catalog failures and clears even errors containing Sync on successful pull", async () => {
    catalogPull.mockResolvedValueOnce({ ok: false, error: "Sync catalog failed" });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(engine.getPosSyncStatus(SITE).lastError).toBe("Sync catalog failed");
    expect(report).toHaveBeenCalledWith({ siteId: SITE, operation: "catalog", error: "Sync catalog failed" });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ pulling: false, lastError: null });
  });

  it("clears catalog failures after a successful unchanged-revision check", async () => {
    catalogPull.mockRejectedValueOnce(new Error("Catalog failed"));
    await engine.pullPosCatalogInBackground(SITE, true);
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: new Date().toISOString() });
    await engine.pullPosCatalogInBackground(SITE);
    expect(catalogPull).toHaveBeenCalledTimes(1);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("reports revision failure even when the fallback snapshot succeeds", async () => {
    revision.mockResolvedValueOnce({ error: "Revision lookup failed" });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ operation: "catalog", error: "Revision lookup failed" }));
    expect(catalogPull).toHaveBeenCalledTimes(1);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("still downloads the full snapshot when the revision request throws", async () => {
    revision.mockRejectedValueOnce(new Error("Revision transport failed"));
    await engine.pullPosCatalogInBackground(SITE);
    expect(catalogPull).toHaveBeenCalledTimes(1);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("publishes catalog phases and completion timing through sync status", async () => {
    const listener = jest.fn();
    const unsubscribe = engine.subscribePosSync(listener, SITE);
    catalogPull.mockImplementationOnce(async (_site, _revision, _bypass, onSaving) => {
      await jest.advanceTimersByTimeAsync(1000);
      onSaving();
      await jest.advanceTimersByTimeAsync(500);
      return { ok: true, pulledAt: new Date().toISOString() };
    });
    await engine.pullPosCatalogInBackground(SITE, true);
    const phases = listener.mock.calls.map(([status]) => status.catalogSync?.phase);
    expect(phases).toEqual(expect.arrayContaining(["checking", "downloading", "saving", "idle"]));
    expect(engine.getPosSyncStatus(SITE).catalogSync).toMatchObject({
      phase: "idle", error: false, startedAt: null, lastSuccess: { durationMs: 1500, fresh: true },
    });
    unsubscribe();
  });

  it("does not restore an old cached snapshot when revision lookup recovers", async () => {
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: new Date().toISOString() });
    revision.mockRejectedValueOnce(new Error("Revision transport failed"));
    await engine.pullPosCatalogInBackground(SITE);
    expect(catalogPull.mock.calls.at(-1)?.slice(0, 3)).toEqual([SITE, null, false]);
    metaGet.mockResolvedValue({ lastCatalogRevision: null, lastPulledAt: new Date().toISOString() });
    await jest.advanceTimersByTimeAsync(120_000);
    await engine.runPosSyncCycle(SITE, false, true);
    expect(catalogPull.mock.calls.at(-1)?.slice(0, 3)).toEqual([SITE, "revision-1", true]);
  });

  it("repairs a missing snapshot even when its stored revision matches", async () => {
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1" });
    await engine.pullPosCatalogInBackground(SITE);
    expect(catalogPull).toHaveBeenLastCalledWith(SITE, "revision-1", true, expect.any(Function));
  });

  it("refreshes stale snapshots without trusting an unchanged revision or its cache", async () => {
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: new Date(Date.now() - 300_000).toISOString() });
    await engine.runPosSyncCycle(SITE);
    expect(catalogPull).toHaveBeenCalledWith(SITE, "revision-1", true, expect.any(Function));
  });

  it("does not postpone the full fallback after repeated unchanged revision checks", async () => {
    const pulledAt = new Date(Date.now()).toISOString();
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: pulledAt });
    await engine.pullPosCatalogInBackground(SITE);
    await jest.advanceTimersByTimeAsync(120_000);
    await engine.runPosSyncCycle(SITE, false, true);
    expect(catalogPull).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(180_000);
    await engine.runPosSyncCycle(SITE);
    expect(catalogPull).toHaveBeenCalledWith(SITE, "revision-1", true, expect.any(Function));
  });

  it("uses an uncached snapshot for an explicit retry", async () => {
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: new Date().toISOString() });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(catalogPull).toHaveBeenCalledWith(SITE, "revision-1", true, expect.any(Function));
  });

  it("refreshes the catalog as well as the queue when connectivity returns", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    engine.startPosSyncLoop(SITE);
    await settleReporting();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(catalogPull).toHaveBeenCalledWith(SITE, "revision-1", true, expect.any(Function));
    engine.stopPosSyncLoop(SITE);
  });

  it("retries a failed full fallback on the next background tick without advancing its freshness", async () => {
    const pulledAt = new Date(Date.now() - 300_000).toISOString();
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: pulledAt });
    catalogPull.mockResolvedValueOnce({ ok: false, error: "Catalog unavailable" });
    engine.startPosSyncLoop(SITE);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ lastError: "Catalog unavailable", lastPulledAt: pulledAt });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(catalogPull).toHaveBeenCalledTimes(2);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
    engine.stopPosSyncLoop(SITE);
  });

  it("does not let an old site's in-flight pull suppress the new site's catalog", async () => {
    let finish!: (value: { ok: boolean }) => void;
    catalogPull.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const oldPull = engine.pullPosCatalogInBackground(SITE);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    const otherSite = "22222222-2222-4222-8222-222222222222";
    expect(engine.getPosSyncStatus(otherSite).pulling).toBe(false);
    await engine.pullPosCatalogInBackground(otherSite);
    expect(catalogPull).toHaveBeenCalledWith(otherSite, "revision-1", true, expect.any(Function));
    finish({ ok: true });
    await oldPull;
  });

  it("keeps the same-site catalog admission slot until its request settles", async () => {
    let finish!: (value: { ok: boolean }) => void;
    catalogPull.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pull = engine.pullPosCatalogInBackground(SITE);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(catalogPull).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await pull;
    expect(engine.getPosSyncStatus(SITE).pulling).toBe(false);
  });

  it("checks the full snapshot deadline when the window regains focus", async () => {
    const pulledAt = new Date(Date.now() - 300_000).toISOString();
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1", lastPulledAt: pulledAt });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    engine.startPosSyncLoop(SITE);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(catalogPull).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    window.dispatchEvent(new Event("focus"));
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(catalogPull).toHaveBeenCalledWith(SITE, "revision-1", true, expect.any(Function));
    engine.stopPosSyncLoop(SITE);
  });

  it.each([false, true])("reports returned and thrown order errors (%s), retaining cached orders until recovery", async (throws) => {
    if (throws) ordersPull.mockRejectedValueOnce(new Error("Orders unavailable"));
    else ordersPull.mockResolvedValueOnce({ error: "Orders unavailable" });
    await engine.pullPosOrdersInBackground(SITE);
    expect(applyOrders).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith({ siteId: SITE, operation: "orders", error: "Orders unavailable" });
    expect(engine.getPosSyncStatus(SITE).lastError).toBe("Orders unavailable");
    await jest.advanceTimersByTimeAsync(30_000);
    await engine.pullPosOrdersInBackground(SITE);
    expect(applyOrders).toHaveBeenCalledWith(SITE, [], expect.objectContaining({ siteId: SITE, generation: 1 }));
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("keeps errors and subscriptions isolated between sites", async () => {
    const otherSite = "22222222-2222-4222-8222-222222222222";
    const listener = jest.fn();
    const unsubscribe = engine.subscribePosSync(listener, otherSite);
    catalogPull.mockResolvedValueOnce({ ok: false, error: "Catalog failed" });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(engine.getPosSyncStatus(otherSite).lastError).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    await engine.pullPosOrdersInBackground(otherSite);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ lastError: null }));
    unsubscribe();
  });

  it("reports local queue reads and resets their error once reads recover", async () => {
    listOutbox.mockRejectedValueOnce(new Error("IndexedDB unavailable"));
    await engine.refreshPosSyncCounts(SITE);
    expect(engine.getPosSyncStatus(SITE).lastError).toBe("IndexedDB unavailable");
    expect(report).toHaveBeenCalledWith({ siteId: SITE, operation: "outbox", error: "IndexedDB unavailable" });
    await engine.refreshPosSyncCounts(SITE);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("does not attempt sync or email while offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    rows = [{ ...queued(), status: "failed", lastError: "Old failure" }];
    await engine.runPosSyncCycle(SITE);
    expect(checkIn).not.toHaveBeenCalled();
    expect(catalogPull).not.toHaveBeenCalled();
    expect(ordersPull).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("failed");
  });

  it("reads the local queue but never replays a cached grant before reconnect verification", async () => {
    const permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
    permission.getPosPermissionLease.mockReturnValue({ siteId: SITE, userId: "cashier", role: "owner", generation: 1, expiresAt: Infinity, offline: true });
    metaGet.mockResolvedValue({ lastPulledAt: "2026-10-23T12:00:00Z" });
    rows = [queued()];
    await engine.runPosSyncCycle(SITE, true);
    await engine.syncPosCheckout(SITE, rows[0].clientMutationId);
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ online: false, accessVerified: true, pendingCount: 1, lastError: null });
    expect(checkIn).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
    expect(ordersPull).not.toHaveBeenCalled();
    expect(catalogPull).not.toHaveBeenCalled();
  });

  it("does not report an interrupted download or orders pull as an error after connection loss", async () => {
    revision.mockImplementationOnce(async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      throw new TypeError("Failed to fetch");
    });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(catalogPull).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    ordersPull.mockImplementationOnce(async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      throw new TypeError("Failed to fetch");
    });
    await engine.pullPosOrdersInBackground(SITE);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });
});