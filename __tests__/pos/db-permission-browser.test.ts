/** @jest-environment node */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";
import type Dexie from "dexie";
import type { DBCoreQuery } from "dexie";
import type * as Database from "@/app/pos/local/db";
import type * as Permission from "@/app/pos/local/location-permission-state";

type Harness = { Dexie: typeof Dexie; db: typeof Database; permission: typeof Permission };
declare global { interface Window { posTest: Harness } }
const headlessShell = path.join(os.homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const executablePath = existsSync(headlessShell) ? headlessShell : chromium.executablePath();
const suite = existsSync(executablePath) ? describe : describe.skip;
const scope = { userId: "actor", siteId: "site", role: "owner" };
function source(file: string) {
  return ts.transpileModule(readFileSync(path.join(process.cwd(), file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

suite("POS permission fence in real Chromium IndexedDB (isolated, no app server)", () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ executablePath, headless: true }); }, 30_000);
  afterAll(async () => { await browser?.close(); });
  beforeEach(async () => {
    page = await browser.newPage();
    // The document is supplied locally; no request reaches a server.
    await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>POS DB test</title>" }));
    await page.goto("http://pos.test/");
    await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/dexie/dist/dexie.js") });
    await page.addScriptTag({ content: `(() => {
      const db = {}, permission = {};
      const load = (source, exports, require) => new Function('exports', 'require', source)(exports, require);
      load(${JSON.stringify(source("app/pos/local/db.ts"))}, db, () => ({ default: Dexie }));
      load(${JSON.stringify(source("app/pos/local/location-permission-state.ts"))}, permission, () => db);
      window.posTest = { db, permission, Dexie };
    })();` });
    await page.evaluate(async (scope) => { await window.posTest.permission.acceptPosPermission(scope, () => true); }, scope);
  });
  afterEach(async () => { await page?.close(); });

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