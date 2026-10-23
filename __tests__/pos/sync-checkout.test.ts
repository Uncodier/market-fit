import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn((siteId: string) => ({ siteId, userId: "cashier", generation: 1 })),
  isPosPermissionCurrent: jest.fn(() => true), subscribePosPermission: () => () => {},
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
  listOutbox: jest.fn(), updateOutboxRow: jest.fn(), mapLocalId: jest.fn(), getServerIdForLocal: jest.fn(),
}));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: jest.fn(), applyPosOpenOrders: jest.fn(),
}));

const SITE = "11111111-1111-4111-8111-111111111111";
let engine: typeof import("@/app/pos/local/sync-engine");
let checkout: jest.Mock;
let recovery: jest.Mock;
let createLead: jest.Mock;
let rows: PosOutboxRow[];
let mappings: Map<string, string>;
let transaction: jest.Mock;

function payment(id: string, data: Partial<CheckoutOutboxPayload> = {}): PosOutboxRow {
  return {
    id: `row-${id}`, clientMutationId: id, kind: "checkout", siteId: SITE,
    status: "pending", attempts: 0, createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z",
    payload: { kind: "checkout", data: { siteId: SITE, userId: "cashier", source: "pos", fulfillment: "pickup",
      clientMutationId: id, lines: [], payments: [{ method: "cash", amount: 10, paymentId: `receipt-${id}` }], ...data } },
  };
}

function lead(id: string): PosOutboxRow {
  return { ...payment(id), kind: "create_lead", payload: { kind: "create_lead", data: {
    siteId: SITE, localLeadId: `local_${id}`, name: "Local customer", clientMutationId: id,
  } } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 80; i++) await Promise.resolve();
}

describe("targeted POS checkout scheduling", () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    rows = [];
    mappings = new Map();
    checkout = jest.mocked((await import("@/app/pos/operation-client")).checkoutPosCart);
    checkout.mockResolvedValue({ success: true, orderId: "server-order", saleId: "sale" });
    createLead = jest.mocked((await import("@/app/pos/operation-client")).createPosLead);
    createLead.mockResolvedValue({ lead: { id: "server-lead" } });
    recovery = jest.mocked((await import("@/app/pos/local/checkout-recovery")).reconcilePosCheckout);
    recovery.mockResolvedValue({ state: "review_required", message: "Unknown" });
    const outbox = jest.mocked(await import("@/app/pos/local/outbox"));
    outbox.listOutbox.mockImplementation(async (siteId, statuses) => rows
      .filter((row) => row.siteId === siteId && (!statuses || statuses.includes(row.status)))
      .map((row) => ({ ...row })));
    outbox.updateOutboxRow.mockImplementation(async (id, patch) => { Object.assign(rows.find((row) => row.id === id)!, patch); });
    outbox.getServerIdForLocal.mockImplementation(async (id) => mappings.get(id) || null);
    outbox.mapLocalId.mockImplementation(async ({ localId, serverId }) => { mappings.set(localId, serverId); });
    transaction = jest.fn(async (_mode, _table, work) => work());
    jest.mocked((await import("@/app/pos/local/db")).getPosDb).mockReturnValue({
      meta: { get: jest.fn() }, transaction,
      outbox: { get: jest.fn(async (id) => rows.find((row) => row.id === id)) },
      leads: { put: jest.fn(), update: jest.fn() },
    } as unknown as ReturnType<typeof import("@/app/pos/local/db").getPosDb>);
    jest.mocked((await import("@/app/pos/actions/report-sync-error")).reportPosSyncError).mockResolvedValue({ ok: true });
    jest.mocked((await import("@/app/pos/catalog-revision-client")).fetchPosCatalogRevision).mockResolvedValue({ data: "revision" });
    jest.mocked((await import("@/app/pos/local/snapshot-pull")).pullAndStorePosCatalogSnapshot).mockResolvedValue({ ok: true });
    engine = await import("@/app/pos/local/sync-engine");
  });

  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it("finishes only its exact mutation while an unrelated background recovery hangs", async () => {
    rows = [{ ...payment("old"), status: "failed", recoveryState: "payment_recorded" }, payment("target"), payment("later")];
    recovery.mockReturnValue(new Promise(() => {}));
    const background = engine.drainPosOutbox(SITE);
    await flush();
    expect(recovery).toHaveBeenCalledWith(SITE, "row-old");
    await engine.syncPosCheckout(SITE, "target");
    expect(rows[1].status).toBe("synced");
    expect(rows[2].status).toBe("pending");
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ clientMutationId: "target" }));
    await jest.advanceTimersByTimeAsync(8_000);
    await background;
    expect(rows[2].status).toBe("synced");
    // The background snapshot must re-read and skip the already-completed target.
    expect(checkout).toHaveBeenCalledTimes(2);
  });

  it.each(["background", "targeted"])("shares the active target started by %s with all callers", async (first) => {
    rows = [payment("target")];
    const request = deferred<{ success: boolean; orderId: string }>();
    checkout.mockReturnValue(request.promise);
    const initial = first === "background" ? engine.drainPosOutbox(SITE) : engine.syncPosCheckout(SITE, "target");
    await flush();
    let finished = false;
    const targeted = engine.syncPosCheckout(SITE, "target").then(() => { finished = true; });
    const background = engine.drainPosOutbox(SITE);
    await flush();
    expect(finished).toBe(false);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(recovery).not.toHaveBeenCalled();
    request.resolve({ success: true, orderId: "order" });
    await Promise.all([initial, targeted, background]);
    expect(rows[0]).toMatchObject({ status: "synced", attempts: 1 });
  });

  it("retains the real request after timeout and applies late success without a replay", async () => {
    rows = [payment("target")];
    const request = deferred<{ success: boolean; orderId: string }>();
    checkout.mockReturnValue(request.promise);
    const first = engine.syncPosCheckout(SITE, "target");
    await jest.advanceTimersByTimeAsync(45_000);
    await first;
    expect(rows[0]).toMatchObject({ status: "failed", lastError: "Sync timed out", attempts: 1 });
    await Promise.all([engine.syncPosCheckout(SITE, "target"), engine.drainPosOutbox(SITE)]);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(recovery).not.toHaveBeenCalled();
    request.resolve({ success: true, orderId: "late-order" });
    await flush();
    expect(rows[0]).toMatchObject({ status: "synced", resultOrderId: "late-order", lastError: null });
    expect(engine.getPosSyncStatus(SITE)).toMatchObject({ syncing: false, failedCount: 0, lastError: null });
  });

  it.each(["failed", "syncing"] as const)("only reconciles an existing %s collected payment with bounded waits", async (status) => {
    rows = [{ ...payment("target"), status }];
    const request = deferred<{ state: string }>();
    recovery.mockImplementation(async () => {
      const result = await request.promise;
      Object.assign(rows[0], { status: "synced", resultOrderId: "recovered", lastError: null });
      return result;
    });
    const first = engine.syncPosCheckout(SITE, "target");
    await jest.advanceTimersByTimeAsync(8_000);
    await first;
    await engine.syncPosCheckout(SITE, "target");
    expect(checkout).not.toHaveBeenCalled();
    expect(recovery).toHaveBeenCalledTimes(1);
    expect(rows[0].payload).toEqual(payment("target").payload);
    request.resolve({ state: "completed" });
    await flush();
    expect(rows[0]).toMatchObject({ status: "synced", resultOrderId: "recovered" });
  });

  it("bounds recovery following a checkout failure and allows a different target", async () => {
    rows = [payment("target"), payment("next")];
    checkout.mockRejectedValueOnce(new Error("Connection lost"));
    recovery.mockReturnValue(new Promise(() => {}));
    const first = engine.syncPosCheckout(SITE, "target");
    await jest.advanceTimersByTimeAsync(8_000);
    await first;
    await engine.syncPosCheckout(SITE, "next");
    expect(rows[0].status).toBe("failed");
    expect(rows[1].status).toBe("synced");
    expect(checkout).toHaveBeenCalledTimes(2);
  });

  it("never overwrites success if the timeout's local transaction runs late", async () => {
    rows = [payment("target")];
    const request = deferred<{ success: boolean; orderId: string }>();
    const write = deferred<void>();
    checkout.mockReturnValue(request.promise);
    transaction.mockImplementationOnce(async (_mode, _table, work) => { await write.promise; await work(); });
    const first = engine.syncPosCheckout(SITE, "target");
    await jest.advanceTimersByTimeAsync(45_000);
    request.resolve({ success: true, orderId: "confirmed" });
    await first;
    write.resolve();
    await flush();
    expect(rows[0]).toMatchObject({ status: "synced", resultOrderId: "confirmed", lastError: null });
  });

  it("syncs the exact local order creator and its lead before paying, without unrelated rows", async () => {
    rows = [lead("unrelated"), payment("unrelated-order"), lead("customer"),
      payment("creator", { payments: [], localLeadId: "local_customer" }), payment("target", { existingOrderId: "local_creator" })];
    await engine.syncPosCheckout(SITE, "target");
    expect(createLead).toHaveBeenCalledTimes(1);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ clientMutationId: "customer" }));
    expect(checkout.mock.calls.map(([data]) => data.clientMutationId)).toEqual(["creator", "target"]);
    expect(checkout.mock.calls[0][0].leadId).toBe("server-lead");
    expect(checkout.mock.calls[1][0].existingOrderId).toBe("server-order");
    expect(rows.slice(0, 2).every((row) => row.status === "pending")).toBe(true);
    expect(rows[4].status).toBe("synced");
  });

  it("uses confirmed mappings without replaying a dependency", async () => {
    rows = [lead("customer"), payment("creator"), payment("target", { localLeadId: "local_customer", existingOrderId: "local_creator" })];
    mappings.set("local_customer", "mapped-lead");
    mappings.set("local_creator", "mapped-order");
    await engine.syncPosCheckout(SITE, "target");
    expect(createLead).not.toHaveBeenCalled();
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ leadId: "mapped-lead", existingOrderId: "mapped-order" }));
  });

  it("joins an active local lead shared by background and targeted work", async () => {
    rows = [lead("customer"), payment("target", { localLeadId: "local_customer" })];
    const request = deferred<{ lead: { id: string } }>();
    createLead.mockReturnValue(request.promise);
    const background = engine.drainPosOutbox(SITE);
    await flush();
    const targeted = engine.syncPosCheckout(SITE, "target");
    await flush();
    expect(createLead).toHaveBeenCalledTimes(1);
    expect(checkout).not.toHaveBeenCalled();
    request.resolve({ lead: { id: "shared-lead" } });
    await Promise.all([background, targeted]);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ leadId: "shared-lead" }));
  });

  it("does not submit a timed-out target after its hanging dependency eventually succeeds", async () => {
    rows = [lead("customer"), payment("target", { localLeadId: "local_customer" })];
    const request = deferred<{ lead: { id: string } }>();
    createLead.mockReturnValue(request.promise);
    const targeted = engine.syncPosCheckout(SITE, "target");
    await jest.advanceTimersByTimeAsync(45_000);
    await targeted;
    expect(rows[1]).toMatchObject({ status: "pending", attempts: 0 });
    request.resolve({ lead: { id: "late-lead" } });
    await flush();
    expect(checkout).not.toHaveBeenCalled();
    expect(rows[1]).toMatchObject({ status: "pending", attempts: 0 });
    await engine.syncPosCheckout(SITE, "target");
    expect(rows[1].status).toBe("synced");
  });

  it("does not wait for another checkout request or an unrelated lead", async () => {
    rows = [lead("unrelated"), payment("old"), payment("target")];
    checkout.mockImplementationOnce(() => new Promise(() => {}));
    const old = engine.syncPosCheckout(SITE, "old");
    await flush();
    await engine.syncPosCheckout(SITE, "target");
    expect(rows[2].status).toBe("synced");
    expect(createLead).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(45_000);
    await old;
  });

  it("retains the active request slot through a permission reset and drops its stale result", async () => {
    rows = [payment("target")];
    const request = deferred<{ success: boolean; orderId: string }>();
    checkout.mockReturnValue(request.promise);
    const first = engine.syncPosCheckout(SITE, "target");
    await flush();
    const permission = jest.mocked(await import("@/app/pos/local/location-permission-state"));
    permission.isPosPermissionCurrent.mockReturnValue(false);
    await jest.advanceTimersByTimeAsync(45_000);
    await first;
    permission.isPosPermissionCurrent.mockReturnValue(true);
    await engine.syncPosCheckout(SITE, "target");
    expect(checkout).toHaveBeenCalledTimes(1);
    permission.isPosPermissionCurrent.mockReturnValue(false);
    request.resolve({ success: true, orderId: "stale" });
    await flush();
    expect(rows[0].status).toBe("syncing");
  });

  it("does not submit the payment or classify it as collected when its dependency fails", async () => {
    rows = [lead("customer"), payment("target", { localLeadId: "local_customer" })];
    createLead.mockResolvedValue({ error: "Lead unavailable" });
    await engine.syncPosCheckout(SITE, "target");
    expect(rows[1]).toMatchObject({ status: "pending", attempts: 0, lastError: "Waiting for local lead to sync" });
    expect(checkout).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
    createLead.mockResolvedValue({ lead: { id: "server-lead" } });
    await engine.syncPosCheckout(SITE, "target");
    expect(rows[1].status).toBe("synced");
  });

  it("reconciles an uncertain collected order dependency without collecting the target", async () => {
    rows = [{ ...payment("creator"), status: "failed" }, payment("target", { existingOrderId: "local_creator" })];
    await engine.syncPosCheckout(SITE, "target");
    expect(recovery).toHaveBeenCalledWith(SITE, "row-creator");
    expect(checkout).not.toHaveBeenCalled();
    expect(rows[1]).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("does not touch a different site, wrong mutation, rejected receipt, or foreign actor", async () => {
    rows = [{ ...payment("other-site"), siteId: "other" }, { ...payment("rejected"), status: "failed", recoveryState: "rejected" },
      payment("foreign", { userId: "previous-cashier" }), payment("unrelated")];
    await engine.syncPosCheckout(SITE, "other-site");
    await engine.syncPosCheckout(SITE, "row-unrelated");
    await engine.syncPosCheckout(SITE, "rejected");
    await engine.syncPosCheckout(SITE, "foreign");
    expect(checkout).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
    expect(rows[3].status).toBe("pending");
  });
});