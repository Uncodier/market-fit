import { getPosDb, lockPosDb, clearPosPrivateData, PosLocalDatabase } from "@/app/pos/local/db";
import {
  acceptPosPermission, preparePosPermission, revokePosPermission,
  suspendPosPermission, restorePosPermission, getPosPermissionLease, isPosPermissionCurrent,
} from "@/app/pos/local/location-permission-state";

type MockTable = { clear: jest.Mock; rows: unknown[] };
const instances: { close: jest.Mock; open: jest.Mock; transaction: jest.Mock; tables: MockTable[] }[] = [];
const tables = new Map<string, MockTable>();
jest.mock("dexie", () => ({
  __esModule: true,
  default: class {
    tables: MockTable[] = [];
    close = jest.fn();
    open = jest.fn(async () => this);
    transaction = jest.fn(async (_mode, _tables, callback: (tx: { abort: jest.Mock }) => Promise<void>) => callback({ abort: jest.fn() }));
    constructor() { instances.push(this); }
    use() { return this; }
    version() { return { stores: (schema: Record<string, string>) => {
      this.tables = Object.keys(schema).map((name) => {
        if (!tables.has(name)) {
          const table: MockTable = { rows: [{ private: true }], clear: jest.fn() };
          table.clear.mockImplementation(async () => { table.rows = []; });
          tables.set(name, table);
        }
        const table = tables.get(name)!;
        Object.assign(this, { [name]: { get: async (siteId: string) => table.rows.find((row) => (row as { siteId?: string }).siteId === siteId) } });
        return table;
      });
    } }; }
  },
}));

const scope = { userId: "actor-a", siteId: "site-a", role: "collaborator" };

describe("POS persisted permission boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    instances.length = 0;
    tables.clear();
    suspendPosPermission();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("denies DB reads by default and after suspension, permanently closes old handles", async () => {
    expect(() => getPosDb()).toThrow("verified access");
    await preparePosPermission(scope.userId, scope.siteId);
    const grant = await acceptPosPermission(scope, () => true);
    const db = getPosDb();
    expect(db).toBeInstanceOf(PosLocalDatabase);
    suspendPosPermission();
    expect(db.close).toHaveBeenCalledWith({ disableAutoOpen: true });
    expect(isPosPermissionCurrent(grant)).toBe(false);
    expect(() => getPosDb()).toThrow();
    await acceptPosPermission(scope, () => true);
    expect(getPosDb()).not.toBe(db);
  });

  it("clears every table, including drafts, outbox, global tax rows and legacy pointers", async () => {
    localStorage.setItem("pos-active-order:site-a", "private-order");
    localStorage.setItem("unrelated", "keep");
    await clearPosPrivateData();
    expect(tables.size).toBe(14);
    for (const table of tables.values()) expect(table.rows).toEqual([]);
    expect(tables.get("outbox")?.clear).toHaveBeenCalled();
    expect(tables.get("cartSessions")?.clear).toHaveBeenCalled();
    expect(localStorage.getItem("pos-active-order:site-a")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(instances[0].transaction).toHaveBeenCalledWith("rw", instances[0].tables, expect.any(Function));
  });

  it("retains same actor/site unconfirmed drafts, but purges on role or actor changes", async () => {
    await acceptPosPermission(scope, () => true);
    tables.get("outbox")!.rows = [{ unconfirmed: true }];
    suspendPosPermission();
    await preparePosPermission(scope.userId, scope.siteId);
    await acceptPosPermission(scope, () => true);
    expect(tables.get("outbox")!.rows).toEqual([{ unconfirmed: true }]);
    await acceptPosPermission({ ...scope, role: "admin" }, () => true);
    expect(tables.get("outbox")!.rows).toEqual([]);
    tables.get("outbox")!.rows = [{ unconfirmed: true }];
    await preparePosPermission("actor-b", scope.siteId);
    expect(tables.get("outbox")!.rows).toEqual([{ unconfirmed: true }]);
    expect(getPosPermissionLease()).toBeNull();
    expect(() => getPosDb()).toThrow();
    expect(await restorePosPermission("actor-b", scope.siteId, () => true)).toBeNull();
    await acceptPosPermission({ ...scope, userId: "actor-b" }, () => true);
    expect(tables.get("outbox")!.rows).toEqual([]);
  });

  it("prepares legacy storage without clearing and purges only once after verified admission", async () => {
    await preparePosPermission(scope.userId, scope.siteId);
    for (const table of tables.values()) expect(table.clear).not.toHaveBeenCalled();
    expect(() => getPosDb()).toThrow();
    await acceptPosPermission(scope, () => true);
    for (const table of tables.values()) expect(table.clear).toHaveBeenCalledTimes(1);
    await preparePosPermission(scope.userId, scope.siteId);
    await acceptPosPermission(scope, () => true);
    for (const table of tables.values()) expect(table.clear).toHaveBeenCalledTimes(1);
  });

  it("preserves all rows and the previous marker when storage writes fail before admission", async () => {
    await acceptPosPermission(scope, () => true);
    tables.get("outbox")!.rows = [{ unconfirmed: true }];
    const marker = localStorage.getItem("pos-location-scope-v1");
    const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Synthetic quota failure", "QuotaExceededError");
    });
    try {
      await expect(preparePosPermission(scope.userId, scope.siteId)).rejects.toMatchObject({ name: "QuotaExceededError" });
      await expect(acceptPosPermission({ ...scope, userId: "other" }, () => true)).rejects.toMatchObject({ name: "QuotaExceededError" });
      expect(tables.get("outbox")!.rows).toEqual([{ unconfirmed: true }]);
      expect(localStorage.getItem("pos-location-scope-v1")).toBe(marker);
      expect(() => getPosDb()).toThrow();
    } finally { write.mockRestore(); }
    await preparePosPermission(scope.userId, scope.siteId);
    await acceptPosPermission(scope, () => true);
    expect(tables.get("outbox")!.rows).toEqual([{ unconfirmed: true }]);
  });

  it("never trusts a pending marker after a failed purge and permits a fresh retry", async () => {
    await preparePosPermission(scope.userId, scope.siteId);
    tables.get("outbox")!.clear.mockRejectedValueOnce(new Error("Transient IDB failure"));
    await expect(acceptPosPermission(scope, () => true)).rejects.toThrow("Transient IDB failure");
    expect(JSON.parse(localStorage.getItem("pos-location-scope-v1")!)).toHaveProperty("pending");
    expect(getPosPermissionLease()).toBeNull();
    expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
    expect(() => getPosDb()).toThrow();
    await preparePosPermission(scope.userId, scope.siteId);
    await acceptPosPermission(scope, () => true);
    expect(getPosPermissionLease()).not.toBeNull();
  });

  it("never grants access when final marker publication fails after a successful purge", async () => {
    await preparePosPermission(scope.userId, scope.siteId);
    const original = Storage.prototype.setItem;
    const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "pos-location-scope-v1" && value.startsWith("[")) throw new Error("Publication failed");
      original.call(this, key, value);
    });
    try {
      await expect(acceptPosPermission(scope, () => true)).rejects.toThrow("Publication failed");
      expect(getPosPermissionLease()).toBeNull();
      expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
      expect(() => getPosDb()).toThrow();
    } finally { write.mockRestore(); }
  });

  it("does not publish ownership when admission becomes stale during a purge", async () => {
    await preparePosPermission(scope.userId, scope.siteId);
    let current = true;
    tables.get("outbox")!.clear.mockImplementationOnce(async () => { current = false; });
    expect(await acceptPosPermission(scope, () => current)).toBeNull();
    expect(getPosPermissionLease()).toBeNull();
    expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
    expect(() => getPosDb()).toThrow();
  });

  it("denies without trusting a persisted marker offline or from another tab", async () => {
    await acceptPosPermission(scope, () => true);
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["another", "site-a", "owner"]));
    expect(() => getPosDb()).toThrow();
    expect(getPosPermissionLease()).toBeNull();
    lockPosDb();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    expect(await acceptPosPermission(scope, () => true)).toBeNull();
    expect(() => getPosDb()).toThrow();
  });

  it("revokes ownership marker and never unlocks if a purge fails", async () => {
    await acceptPosPermission(scope, () => true);
    tables.get("outbox")!.clear.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(revokePosPermission()).rejects.toThrow("storage unavailable");
    expect(localStorage.getItem("pos-location-scope-v1")).toBeNull();
    expect(() => getPosDb()).toThrow();
  });

  it("bounds a stalled open, retains pending rows and allows a fresh preparation", async () => {
    jest.useFakeTimers();
    try {
      const purge = clearPosPrivateData();
      const db = instances[0];
      let rejectOpen!: (error: Error) => void;
      db.open.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOpen = reject; }));
      db.close.mockImplementation(() => rejectOpen?.(new Error("Database closed")));
      const failure = expect(purge).rejects.toMatchObject({ name: "PosStorageTimeoutError" });
      await jest.advanceTimersByTimeAsync(8_000);
      await failure;
      expect(db.close).toHaveBeenCalledWith({ disableAutoOpen: true });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(tables.get("outbox")!.rows).toEqual([{ private: true }]);
      expect(() => getPosDb()).toThrow();
      await preparePosPermission(scope.userId, scope.siteId);
      await acceptPosPermission(scope, () => true);
      expect(getPosPermissionLease()).not.toBeNull();
    } finally {
      suspendPosPermission();
      jest.useRealTimers();
    }
  });

  it("aborts an active purge transaction before releasing its timed-out wait", async () => {
    jest.useFakeTimers();
    try {
      const purge = clearPosPrivateData();
      const db = instances[0];
      const abort = jest.fn();
      db.transaction.mockImplementationOnce(async (_mode, _tables, callback) => callback({ abort }));
      tables.get("outbox")!.clear.mockImplementationOnce(() => new Promise(() => {}));
      const failure = expect(purge).rejects.toMatchObject({ name: "PosStorageTimeoutError" });
      await jest.advanceTimersByTimeAsync(8_000);
      await failure;
      expect(abort).toHaveBeenCalledTimes(1);
      expect(db.close).toHaveBeenCalledWith({ disableAutoOpen: true });
      expect(() => getPosDb()).toThrow();
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects an elapsed monotonic deadline before the timer runs, even after wall-clock rollback", async () => {
    let elapsed = 100;
    const monotonic = jest.spyOn(performance, "now").mockImplementation(() => elapsed);
    const wallClock = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const grant = await acceptPosPermission(scope, () => true);
      expect(isPosPermissionCurrent(grant)).toBe(true);
      wallClock.mockReturnValue(1);
      elapsed += 38_001;
      expect(isPosPermissionCurrent(grant)).toBe(false);
      expect(getPosPermissionLease()).toBeNull();
      expect(() => getPosDb()).toThrow("verified access");
    } finally {
      suspendPosPermission();
      monotonic.mockRestore();
      wallClock.mockRestore();
    }
  });

  it("restores a downloaded same-scope cache offline without expiring or retiring its DB handle", async () => {
    const initial = await acceptPosPermission(scope, () => true);
    const db = getPosDb();
    tables.get("meta")!.rows = [{ siteId: scope.siteId, lastPulledAt: "2026-10-23T12:00:00Z" }];
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const restored = await restorePosPermission(scope.userId, scope.siteId, () => true);
    expect(restored).toMatchObject({ offline: true, generation: initial?.generation });
    expect(getPosDb()).toBe(db);
    expect(isPosPermissionCurrent(initial)).toBe(true);
    suspendPosPermission();
    const reopened = await restorePosPermission(scope.userId, scope.siteId, () => true);
    expect(reopened?.offline).toBe(true);
    expect(getPosDb()).not.toBe(db);
    await revokePosPermission();
    expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
    expect(() => getPosDb()).toThrow();
  });

  it("never restores another actor/site or a marker without a downloaded snapshot", async () => {
    await acceptPosPermission(scope, () => true);
    expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
    tables.get("meta")!.rows = [{ siteId: scope.siteId, lastPulledAt: "2026-10-23T12:00:00Z" }];
    expect(await restorePosPermission("other-actor", scope.siteId, () => true)).toBeNull();
    expect(await restorePosPermission(scope.userId, "other-site", () => true)).toBeNull();
    expect(await restorePosPermission(scope.userId, scope.siteId, () => false)).toBeNull();
    localStorage.setItem("pos-location-scope-v1", JSON.stringify([scope.userId, scope.siteId, "invalid-role"]));
    expect(await restorePosPermission(scope.userId, scope.siteId, () => true)).toBeNull();
  });
});