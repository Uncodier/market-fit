/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";
import type * as Database from "@/app/pos/local/db";
import type * as Permission from "@/app/pos/local/location-permission-state";
import type * as Snapshot from "@/app/pos/local/snapshot-pull";
import type * as Engine from "@/app/pos/local/sync-engine";
import type { PosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import type { PosOutboxRow, LocalPendingOrder } from "@/app/pos/local/types";

type CatalogResult = { data: PosCatalogSnapshot } | { error: string };
type OrdersResult = { data: LocalPendingOrder["raw"][] };
type Harness = {
  db: typeof Database; permission: typeof Permission; snapshot: typeof Snapshot; engine: typeof Engine;
  requests: {
    orders: number; catalog: number; reports: unknown[];
    finishOrders: (result: OrdersResult) => void;
    finishCatalog: (result: CatalogResult) => void;
  };
};
declare global { interface Window { snapshotSafety: Harness } }
const scope = { userId: "actor", siteId: "site", role: "owner" };
const headlessShell = path.join(os.homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const executablePath = existsSync(headlessShell) ? headlessShell : chromium.executablePath();
const suite = existsSync(executablePath) ? describe : describe.skip;

function source(file: string) {
  return ts.transpileModule(readFileSync(path.join(process.cwd(), file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function order(id: string, mutationId?: string): LocalPendingOrder {
  return { id, site_id: scope.siteId, status: "pending", amount_due: 10, created_at: "2026-10-23T12:00:00Z",
    raw: { id, status: "pending", amount_due: 10, pending_sync: !!mutationId, client_mutation_id: mutationId } };
}

function checkout(id: string, status: PosOutboxRow["status"] = "pending", existingOrderId?: string): PosOutboxRow {
  return { id, siteId: scope.siteId, kind: "checkout", clientMutationId: id, status, attempts: 0,
    createdAt: "2026-10-23T12:00:00Z", updatedAt: "2026-10-23T12:00:00Z",
    payload: { kind: "checkout", data: { siteId: scope.siteId, userId: scope.userId, clientMutationId: id,
      lines: [], fulfillment: "dine_in", source: "pos", existingOrderId } } };
}

suite("POS snapshot safety with real Chromium IndexedDB (isolated, no app server)", () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ executablePath, headless: true }); }, 30_000);
  afterAll(async () => { await browser?.close(); });
  beforeEach(async () => {
    page = await browser.newPage();
    await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Snapshot test</title>" }));
    await page.goto("http://pos.test/");
    await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/dexie/dist/dexie.js") });
    const modules = Object.fromEntries([
      "db", "location-permission-state", "remote-permission", "snapshot-pull", "sync-engine",
      "sync-errors", "sync-policy", "catalog-sync-progress", "indexeddb-runtime", "storage-diagnostic",
    ].map((name) => [`./${name}`, source(`app/pos/local/${name}.ts`)]));
    modules["@/app/pos/open-orders"] = source("app/pos/open-orders.ts");
    await page.addScriptTag({ content: `(() => {
      const sources = ${JSON.stringify(modules)}, cache = {};
      const requests = { orders: 0, catalog: 0, reports: [] };
      const mocks = {
        dexie: { default: Dexie },
        '@/app/pos/actions/list-open-orders': { listPosOpenOrders: () => {
          requests.orders++; return new Promise(resolve => { requests.finishOrders = resolve; });
        } },
        '@/app/pos/actions/pull-snapshot': { pullPosCatalogSnapshot: () => {
          requests.catalog++; return new Promise(resolve => { requests.finishCatalog = resolve; });
        } },
        '@/app/pos/catalog-revision-client': { fetchPosCatalogRevision: async () => ({ data: 'revision' }) },
        '@/app/pos/actions/report-sync-error': { reportPosSyncError: async report => { requests.reports.push(report); return {}; } },
        './sync-outbox-worker': { hasPosOutboxWork: () => false, syncPosOutboxRow: async () => {} },
        './outbox': { listOutbox: siteId => load('./db').getPosDb().outbox.where('siteId').equals(siteId).toArray() },
      };
      function load(id) {
        if (mocks[id]) return mocks[id];
        if (cache[id]) return cache[id];
        if (!sources[id]) throw new Error('Unexpected dependency: ' + id);
        const exports = cache[id] = {};
        new Function('exports', 'require', sources[id])(exports, load);
        return exports;
      }
      window.snapshotSafety = { db: load('./db'), permission: load('./location-permission-state'),
        snapshot: load('./snapshot-pull'), engine: load('./sync-engine'), requests };
    })();` });
    await page.evaluate(async (scope) => {
      const { db, permission } = window.snapshotSafety;
      await permission.acceptPosPermission(scope, () => true);
      await db.getPosDb().meta.put({ siteId: scope.siteId, lastPulledAt: "2026-10-23T12:00:00Z", schemaVersion: 1 });
    }, scope);
  });
  afterEach(async () => { await page?.close(); });

  it.each(["browser-offline", "local-only", "reconnected"] as const)(
    "does not overwrite the local projection with an orders response after %s", async (transition) => {
      const result = await page.evaluate(async ({ transition, scope, pending }) => {
        const { db, permission, engine, requests } = window.snapshotSafety;
        await db.getPosDb().pendingOrders.put(pending);
        const original = permission.getPosPermissionLease()!;
        const pulling = engine.pullPosOrdersInBackground(scope.siteId);
        await Promise.resolve();
        Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
        if (transition !== "browser-offline") await permission.restorePosPermission(scope.userId, scope.siteId, () => true);
        if (transition !== "browser-offline") Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
        if (transition === "reconnected") await permission.acceptPosPermission(scope, () => true);
        const current = permission.getPosPermissionLease()!;
        requests.finishOrders({ data: [] });
        await pulling;
        return { ids: (await db.getPosDb().pendingOrders.toArray()).map(row => row.id),
          generationUnchanged: original.generation === current.generation, reports: requests.reports,
          lastPull: engine.getPosSyncStatus(scope.siteId).lastOrdersPulledAt };
      }, { transition, scope, pending: order("local_pending", "pending") });
      expect(result).toEqual({ ids: ["local_pending"], generationUnchanged: true, reports: [], lastPull: null });
    },
  );

  it.each(["offline", "local-only", "reconnected"] as const)(
    "does not report a returned catalog error after %s", async (transition) => {
      const result = await page.evaluate(async ({ scope, transition }) => {
        const { permission, engine, requests } = window.snapshotSafety;
        const pulling = engine.pullPosCatalogInBackground(scope.siteId, true);
        while (!requests.catalog) await new Promise(resolve => setTimeout(resolve, 0));
        Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
        await permission.restorePosPermission(scope.userId, scope.siteId, () => true);
        if (transition !== "offline") Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
        if (transition === "reconnected") await permission.acceptPosPermission(scope, () => true);
        requests.finishCatalog({ error: "Late catalog failure" });
        await pulling;
        return { reports: requests.reports, status: engine.getPosSyncStatus(scope.siteId) };
      }, { scope, transition });
      expect(result.reports).toEqual([]);
      expect(result.status).toMatchObject({ lastError: null, pulling: false, catalogSync: { phase: "idle", error: false } });
    },
  );

  it("still reports a returned catalog error while the remote lease remains current", async () => {
    const result = await page.evaluate(async (siteId) => {
      const { engine, requests } = window.snapshotSafety;
      const pulling = engine.pullPosCatalogInBackground(siteId, true);
      while (!requests.catalog) await new Promise(resolve => setTimeout(resolve, 0));
      requests.finishCatalog({ error: "Catalog unavailable" });
      await pulling;
      return { reports: requests.reports, error: engine.getPosSyncStatus(siteId).lastError };
    }, scope.siteId);
    expect(result.error).toBe("Catalog unavailable");
    expect(result.reports).toEqual([{ siteId: scope.siteId, operation: "catalog", error: "Catalog unavailable" }]);
  });

  it.each(["offline", "reconnected", "renewed"] as const)(
    "fences catalog replacement after %s without rejecting ordinary lease renewal", async (transition) => {
      const result = await page.evaluate(async ({ scope, transition }) => {
        const { db, permission, snapshot, requests } = window.snapshotSafety;
        const original = permission.getPosPermissionLease()!;
        const pulling = snapshot.pullAndStorePosCatalogSnapshot(scope.siteId, "new-revision");
        if (transition !== "renewed") {
          Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
          await permission.restorePosPermission(scope.userId, scope.siteId, () => true);
        }
        if (transition !== "offline") {
          Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
          await permission.acceptPosPermission(scope, () => true);
        }
        requests.finishCatalog({ data: {
          catalogItems: [], categories: [], locations: [], leads: [], priceLists: [], priceListItems: [],
          taxesByItem: {}, promotions: [], modifierGroupsByHostId: {}, inventorySnapshot: { policy: "block", levels: [] }, pulledAt: "2026-10-23T13:00:00Z",
        } });
        const outcome = await pulling;
        return { outcome, sameGeneration: original.generation === permission.getPosPermissionLease()!.generation,
          meta: await db.getPosDb().meta.get(scope.siteId) };
      }, { scope, transition });
      expect(result.sameGeneration).toBe(true);
      if (transition === "renewed") {
        expect(result.outcome.ok).toBe(true);
        expect(result.meta?.lastCatalogRevision).toBe("new-revision");
      } else {
        expect(result.outcome.ok).toBe(false);
        expect(result.meta?.lastPulledAt).toBe("2026-10-23T12:00:00Z");
        expect(result.meta?.lastCatalogRevision).toBeUndefined();
      }
    },
  );

  it("retains pending, syncing and failed local orders, but drops synced and orphaned placeholders", async () => {
    const pending = [order("local_pending", "pending"), order("local_syncing", "syncing"),
      order("local_failed", "failed"), order("local_synced", "synced"), order("local_orphan", "orphan"),
      order("stale-server"), { ...order("foreign"), site_id: "other-site" }];
    const rows = [checkout("pending"), checkout("syncing", "syncing"), checkout("failed", "failed"), checkout("synced", "synced"),
      { ...checkout("orphan"), siteId: "other-site" }];
    const result = await page.evaluate(async ({ pending, rows, siteId }) => {
      const { db, snapshot } = window.snapshotSafety;
      const handle = db.getPosDb();
      await handle.pendingOrders.bulkPut(pending);
      await handle.outbox.bulkPut(rows);
      await snapshot.applyPosOpenOrders(siteId, [{ id: "remote", status: "pending", amount_due: 20 }]);
      const retained = (await handle.pendingOrders.toArray()).map(row => row.id).sort();
      await handle.outbox.where("siteId").equals(siteId).modify({ status: "synced" });
      await snapshot.applyPosOpenOrders(siteId, []);
      return { retained, afterReplay: (await handle.pendingOrders.toArray()).map(row => row.id) };
    }, { pending, rows, siteId: scope.siteId });
    expect(result.retained).toEqual(["foreign", "local_failed", "local_pending", "local_syncing", "remote"]);
    expect(result.afterReplay).toEqual(["foreign"]);
  });

  it("keeps an unsynchronized existing-order edit over its stale remote copy", async () => {
    const result = await page.evaluate(async ({ pending, row, siteId }) => {
      const { db, snapshot } = window.snapshotSafety;
      await db.getPosDb().pendingOrders.put(pending);
      await db.getPosDb().outbox.put(row);
      await snapshot.applyPosOpenOrders(siteId, [{ id: pending.id, status: "pending", amount_due: 99 }]);
      return db.getPosDb().pendingOrders.toArray();
    }, { pending: order("existing-order", "edit"), row: checkout("edit", "syncing", "existing-order"), siteId: scope.siteId });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "existing-order", amount_due: 10, raw: { pending_sync: true } });
  });

  it("uses order mappings to retain dependent replay work, then removes the mapped placeholder after sync", async () => {
    const result = await page.evaluate(async ({ pending, rows, siteId }) => {
      const { db, snapshot } = window.snapshotSafety;
      const handle = db.getPosDb();
      await handle.pendingOrders.put(pending);
      await handle.outbox.bulkPut(rows);
      await handle.idMaps.put({ localId: pending.id, serverId: "server-order", siteId, kind: "order" });
      const remote = [{ id: "server-order", status: "pending", amount_due: 99 }];
      await snapshot.applyPosOpenOrders(siteId, remote);
      const duringReplay = await handle.pendingOrders.toArray();
      await handle.outbox.update("followup", { status: "synced" });
      await snapshot.applyPosOpenOrders(siteId, remote);
      return { duringReplay, afterReplay: await handle.pendingOrders.toArray() };
    }, { pending: order("local_created", "created"),
      rows: [checkout("created", "synced"), checkout("followup", "pending", "server-order")], siteId: scope.siteId });
    expect(result.duringReplay.map(row => row.id)).toEqual(["local_created"]);
    expect(result.afterReplay.map(row => row.id)).toEqual(["server-order"]);
    expect(result.afterReplay[0].raw.pending_sync).toBeUndefined();
  });

  it("rolls back an orders transaction if connectivity changes during projection replacement", async () => {
    const result = await page.evaluate(async ({ pending, siteId }) => {
      const { db, permission, snapshot } = window.snapshotSafety;
      const handle = db.getPosDb();
      await handle.pendingOrders.put(pending);
      const token = permission.getPosPermissionLease()!;
      handle.pendingOrders.hook("deleting", () => {
        Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      });
      const outcome = await snapshot.applyPosOpenOrders(siteId, [], token).then(() => "committed", () => "aborted");
      return { outcome, ids: (await handle.pendingOrders.toArray()).map(row => row.id) };
    }, { pending: order("cached"), siteId: scope.siteId });
    expect(result).toEqual({ outcome: "aborted", ids: ["cached"] });
  });
});