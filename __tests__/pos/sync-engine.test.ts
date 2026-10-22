import type { PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn((siteId: string) => ({ siteId, userId: "cashier", generation: 1 })),
  isPosPermissionCurrent: jest.fn(() => true),
  subscribePosPermission: () => () => {},
}));

jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/commerce/ticket-check-in", () => ({ checkInTicket: jest.fn() }));
jest.mock("@/app/pos/actions/create-lead-sync", () => ({ createLeadWithIdempotency: jest.fn() }));
jest.mock("@/app/pos/actions/sync-revision", () => ({ getPosCatalogRevision: jest.fn() }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/orders/actions", () => ({ updateOrderNotes: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn() }));
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
    revision = jest.mocked((await import("@/app/pos/actions/sync-revision")).getPosCatalogRevision);
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
    jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({ meta: { get: metaGet } } as unknown as ReturnType<typeof import("@/app/pos/local/db").getPosDb>);
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
    for (let i = 0; i < 15 && !finish; i++) await Promise.resolve();
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
    const checkout = jest.mocked((await import("@/app/commerce/checkout")).checkoutCart);
    expect(checkout).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "POS account changed" });
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

  it("reports timeout and restores the status when a later attempt succeeds", async () => {
    rows = [queued()];
    checkIn.mockImplementationOnce(() => new Promise(() => {}));
    const drain = engine.drainPosOutbox(SITE);
    await jest.advanceTimersByTimeAsync(45_000);
    await drain;
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "Sync timed out" });
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ error: "Sync timed out" }));
    await engine.drainPosOutbox(SITE);
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
    metaGet.mockResolvedValue({ lastCatalogRevision: "revision-1" });
    await engine.pullPosCatalogInBackground(SITE);
    expect(catalogPull).toHaveBeenCalledTimes(1);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
  });

  it("reports revision failure even when the fallback snapshot succeeds", async () => {
    revision.mockResolvedValueOnce({ error: "Revision lookup failed" });
    await engine.pullPosCatalogInBackground(SITE, true);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ operation: "catalog", error: "Revision lookup failed" }));
    expect(catalogPull).toHaveBeenCalledWith(SITE, null);
    expect(engine.getPosSyncStatus(SITE).lastError).toBeNull();
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
    expect(applyOrders).toHaveBeenCalledWith(SITE, []);
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
});