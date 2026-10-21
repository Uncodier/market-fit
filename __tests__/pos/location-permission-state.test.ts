import { getPosDb, lockPosDb, clearPosPrivateData, PosLocalDatabase } from "@/app/pos/local/db";
import {
  acceptPosPermission, preparePosPermission, revokePosPermission,
  suspendPosPermission, getPosPermissionLease, isPosPermissionCurrent,
} from "@/app/pos/local/location-permission-state";

type MockTable = { clear: jest.Mock; rows: unknown[] };
const instances: { close: jest.Mock; transaction: jest.Mock; tables: MockTable[] }[] = [];
const tables = new Map<string, MockTable>();
jest.mock("dexie", () => ({
  __esModule: true,
  default: class {
    tables: MockTable[] = [];
    close = jest.fn();
    transaction = jest.fn(async (_mode, _tables, callback: () => Promise<void>) => callback());
    constructor() { instances.push(this); }
    use() { return this; }
    version() { return { stores: (schema: Record<string, string>) => {
      this.tables = Object.keys(schema).map((name) => {
        if (!tables.has(name)) {
          const table: MockTable = { rows: [{ private: true }], clear: jest.fn() };
          table.clear.mockImplementation(async () => { table.rows = []; });
          tables.set(name, table);
        }
        return tables.get(name)!;
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
    expect(() => getPosDb()).toThrow("verified online access");
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
    expect(tables.get("outbox")!.rows).toEqual([]);
    expect(getPosPermissionLease()).toBeNull();
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
      expect(() => getPosDb()).toThrow("verified online access");
    } finally {
      suspendPosPermission();
      monotonic.mockRestore();
      wallClock.mockRestore();
    }
  });
});