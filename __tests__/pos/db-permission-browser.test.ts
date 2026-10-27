/** @jest-environment node */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium, webkit, type Browser, type Page } from "playwright";
import ts from "typescript";
import type Dexie from "dexie";
import type { DBCoreQuery } from "dexie";
import type * as Database from "@/app/pos/local/db";
import type * as Permission from "@/app/pos/local/location-permission-state";

type Harness = { Dexie: typeof Dexie; db: typeof Database; permission: typeof Permission };
declare global { interface Window { posTest: Harness } }
const headlessShell = path.join(os.homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const executablePath = existsSync(headlessShell) ? headlessShell : chromium.executablePath();
const scope = { userId: "actor", siteId: "site", role: "owner" };
function source(file: string) {
  return ts.transpileModule(readFileSync(path.join(process.cwd(), file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

describe.each([
  { name: "Chromium", engine: chromium, executable: executablePath },
  { name: "WebKit", engine: webkit, executable: webkit.executablePath() },
])("POS permission fence in real $name IndexedDB (isolated, no app server)", ({ engine, executable }) => {
  const suite = existsSync(executable) ? describe : describe.skip;
  suite("available browser", () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await engine.launch({ executablePath: executable, headless: true }); }, 30_000);
  afterAll(async () => { await browser?.close(); });
  beforeEach(async () => {
    page = await browser.newPage();
    // The document is supplied locally; no request reaches a server.
    await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>POS DB test</title>" }));
    await page.goto("http://pos.test/");
    await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/dexie/dist/dexie.js") });
    await page.addScriptTag({ content: `(() => {
      const db = {}, permission = {}, diagnostic = {};
      const load = (source, exports, require) => new Function('exports', 'require', source)(exports, require);
      load(${JSON.stringify(source("app/pos/local/db.ts"))}, db, () => ({ default: Dexie }));
      load(${JSON.stringify(source("app/pos/local/storage-diagnostic.ts"))}, diagnostic, () => { throw new Error('Unexpected import'); });
      load(${JSON.stringify(source("app/pos/local/location-permission-state.ts"))}, permission, (name) => name === './db' ? db : diagnostic);
      window.posTest = { db, permission, Dexie };
    })();` });
    await page.evaluate(async (scope) => { await window.posTest.permission.acceptPosPermission(scope, () => true); }, scope);
  });
  afterEach(async () => { await page?.close(); });

  it("preserves legacy work on failed writes, then performs one authorized purge on retry", async () => {
    const result = await page.evaluate(async (scope) => {
      const { db, permission } = window.posTest;
      await db.getPosDb().leads.put({ id: "legacy-private", site_id: scope.siteId });
      permission.suspendPosPermission();
      localStorage.removeItem("pos-location-scope-v1");
      const originalClear = IDBObjectStore.prototype.clear;
      const originalSet = Storage.prototype.setItem;
      let clears = 0;
      IDBObjectStore.prototype.clear = function () { clears++; return originalClear.call(this); };
      Storage.prototype.setItem = function (key, value) {
        if (key === "pos-location-scope-v1") throw new DOMException("Synthetic denial", "QuotaExceededError");
        return originalSet.call(this, key, value);
      };
      try {
        await permission.preparePosPermission(scope.userId, scope.siteId);
        const error = await permission.acceptPosPermission(scope, () => true).then(() => null, (error) => error.name);
        const inspect = new db.PosLocalDatabase();
        const retained = !!await inspect.leads.get("legacy-private");
        inspect.close();
        const beforeRetry = { error, retained, clears, allowed: !!permission.getPosPermissionLease() };
        Storage.prototype.setItem = originalSet;
        await permission.preparePosPermission(scope.userId, scope.siteId);
        await permission.acceptPosPermission(scope, () => true);
        await permission.preparePosPermission(scope.userId, scope.siteId);
        await permission.acceptPosPermission(scope, () => true);
        return { beforeRetry, clears, allowed: !!permission.getPosPermissionLease() };
      } finally {
        IDBObjectStore.prototype.clear = originalClear;
        Storage.prototype.setItem = originalSet;
      }
    }, scope);
    expect(result).toEqual({ beforeRetry: { error: "QuotaExceededError", retained: true, clears: 0, allowed: false }, clears: 14, allowed: true });
  });

  it("reads and writes downloaded IndexedDB data offline, restores after reload and fences sign-out", async () => {
    await page.evaluate(async (scope) => {
      const handle = window.posTest.db.getPosDb();
      await handle.meta.put({ siteId: scope.siteId, lastPulledAt: "2026-10-23T12:00:00Z", schemaVersion: 1 });
      await handle.leads.put({ id: "cached-lead", site_id: scope.siteId, name: "Downloaded customer" });
    }, scope);
    await page.context().setOffline(true);
    const result = await page.evaluate(async (scope) => {
      const { db, permission } = window.posTest;
      const original = db.getPosDb();
      const onlineGrant = permission.getPosPermissionLease()!;
      const offlineGrant = await permission.restorePosPermission(scope.userId, scope.siteId, () => true);
      const sameHandle = db.getPosDb() === original;
      await original.cartSessions.put({ siteId: scope.siteId, updatedAt: "now", cart: [], sentLineQuantities: {},
        leadValue: null, fulfillment: "pickup", originLocationId: "", priceListId: "", promoCode: "", activeOrderId: "", buyerUserId: null });
      permission.suspendPosPermission();
      await permission.preparePosPermission(scope.userId, scope.siteId);
      await permission.restorePosPermission(scope.userId, scope.siteId, () => true);
      const handle = db.getPosDb();
      const lead = await handle.leads.get("cached-lead");
      const draft = await handle.cartSessions.get(scope.siteId);
      await permission.revokePosPermission();
      const cannotRestore = await permission.restorePosPermission(scope.userId, scope.siteId, () => true) === null;
      const denied = await handle.leads.get("cached-lead").then(() => false, () => true);
      return { offline: offlineGrant?.offline, sameHandle, sameGeneration: offlineGrant?.generation === onlineGrant.generation,
        lead: lead?.name, draft: !!draft, cannotRestore, denied, browserOffline: !navigator.onLine };
    }, scope);
    expect(result).toEqual({ offline: true, sameHandle: true, sameGeneration: true, lead: "Downloaded customer",
      draft: true, cannotRestore: true, denied: true, browserOffline: true });
  });

  it.each(["suspend", "revoke"] as const)("aborts a live rw transaction on %s and cannot commit its earlier write", async (mode) => {
    const result = await page.evaluate(async ({ mode, scope }) => {
      const { db, permission } = window.posTest;
      const handle = db.getPosDb();
      await handle.leads.put({ id: "private", site_id: "site", name: "original" });
      let leaked = false;
      let revocation: Promise<void> = Promise.resolve();
      const transaction = handle.transaction("rw", handle.leads, async () => {
        await handle.leads.put({ id: "private", site_id: "site", name: "must rollback" });
        // Still in Dexie.currentTransaction after an awaited request. Closing the
        // connection alone does not abort this transaction or its buffered write.
        revocation = mode === "revoke" ? permission.revokePosPermission() : (permission.suspendPosPermission(), Promise.resolve());
        leaked = !!(await handle.leads.get("private"));
        await handle.leads.put({ id: "late", site_id: "site" });
      }).then(() => "committed", () => "aborted");
      const status = await transaction;
      await revocation;
      await permission.acceptPosPermission(scope, () => true);
      const rows = await db.getPosDb().leads.toArray();
      const oldHandleDenied = await handle.leads.get("private").then(() => false, () => true);
      return { status, leaked, rows, oldHandleDenied };
    }, { mode, scope });
    expect(result.status).toBe("aborted");
    expect(result.leaked).toBe(false);
    expect(result.oldHandleDenied).toBe(true);
    expect(result.rows).toEqual(mode === "revoke" ? [] : [{ id: "private", site_id: "site", name: "original" }]);
  });

  it.each(["get", "getMany", "query", "openCursor", "count", "mutate"] as const)("gates %s inside an already-created current transaction", async (operation) => {
    const result = await page.evaluate(async (operation) => {
      const { db } = window.posTest;
      let allowed = true;
      const handle = new db.PosLocalDatabase(() => allowed);
      await handle.leads.put({ id: "private", site_id: "site" });
      let denied = false;
      const transaction = await handle.transaction("rw", handle.leads, async (tx) => {
        const core = handle.leads.core;
        const query: DBCoreQuery = { index: core.schema.primaryKey, range: { type: 3, lower: undefined, upper: undefined } };
        const trans = tx.idbtrans;
        // No lock/close call: the per-operation lease predicate must fence this.
        allowed = false;
        try {
          switch (operation) {
            case "get": await core.get({ trans, key: "private" }); break;
            case "getMany": await core.getMany({ trans, keys: ["private"] }); break;
            case "query": await core.query({ trans, query, values: true }); break;
            case "openCursor": await core.openCursor({ trans, query, values: true }); break;
            case "count": await core.count({ trans, query }); break;
            case "mutate": await core.mutate({ trans, type: "put", values: [{ id: "late", site_id: "site" }] }); break;
          }
        } catch (error) { denied = (error as Error).message === "POS access changed"; }
      }).then(() => "committed", () => "aborted");
      handle.close();
      return { denied, transaction };
    }, operation);
    expect(result).toEqual({ denied: true, transaction: "aborted" });
  });

  it("aborts buffered writes on suspension even without any later table operation", async () => {
    const result = await page.evaluate(async (scope) => {
      const { db, permission } = window.posTest;
      const handle = db.getPosDb();
      await handle.leads.put({ id: "private", site_id: "site", name: "original" });
      const status = await handle.transaction("rw", handle.leads, async () => {
        await handle.leads.put({ id: "private", site_id: "site", name: "must rollback" });
        permission.suspendPosPermission();
        // No next query to trigger the per-table gate: lock itself must abort.
      }).then(() => "committed", () => "aborted");
      await permission.acceptPosPermission(scope, () => true);
      return { status, row: await db.getPosDb().leads.get("private") };
    }, scope);
    expect(result).toEqual({ status: "aborted", row: { id: "private", site_id: "site", name: "original" } });
  });

  it("does not deliver a read which resolves after its lease becomes invalid", async () => {
    const result = await page.evaluate(async () => {
      const { db } = window.posTest;
      let allowed = true;
      let invalidateRead = false;
      const handle = new db.PosLocalDatabase(() => allowed);
      // A lower middleware controls the exact response boundary; real IndexedDB
      // still performs the read and the production permission middleware runs.
      handle.use({ stack: "dbcore", level: 90, name: "test response barrier", create: (core) => ({ ...core,
        table: (name) => {
          const table = core.table(name);
          return { ...table, get: (req) => table.get(req).then((row) => {
            if (invalidateRead) allowed = false;
            return row;
          }) };
        },
      }) });
      await handle.leads.put({ id: "private", site_id: "site" });
      invalidateRead = true;
      const denied = await handle.leads.get("private").then(() => false, (error) => error.message === "POS access changed");
      handle.close();
      return denied;
    });
    expect(result).toBe(true);
  });
  });
});