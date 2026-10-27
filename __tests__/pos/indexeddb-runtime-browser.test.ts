/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { webkit, chromium, type Browser, type Page } from "playwright";
import ts from "typescript";

function source(file: string) {
  return ts.transpileModule(readFileSync(path.join(process.cwd(), file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

describe.each([webkit, chromium])("native IndexedDB recovery (%s)", (engine) => {
  const suite = existsSync(engine.executablePath()) ? describe : describe.skip;
  suite("isolated production Dexie", () => {
    let browser: Browser;
    let page: Page;
    beforeAll(async () => { browser = await engine.launch({ headless: true }); });
    afterAll(async () => { await browser?.close(); });
    beforeEach(async () => {
      page = await browser.newPage();
      await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native storage repair</title>" }));
      await page.goto("https://pos.test/");
      await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/dexie/dist/dexie.min.js") });
      await page.addScriptTag({ content: `(() => {
        const runtime = {}, db = {};
        const load = (source, exports, require) => new Function('exports', 'require', source)(exports, require);
        load(${JSON.stringify(source("app/pos/local/indexeddb-runtime.ts"))}, runtime, () => {});
        load(${JSON.stringify(source("app/pos/local/db.ts"))}, db, name => name === 'dexie' ? {default: Dexie} : runtime);
        window.nativeTest = { runtime, db, Dexie };
      })();` });
    });
    afterEach(async () => { await page?.close(); });

    it.each(["captured", "webkit", "present"])("keeps existing rows and writes durably with %s native factory", async (mode) => {
      const result = await page.evaluate(async (mode) => {
        const { db, Dexie } = (window as unknown as { nativeTest: {
          db: typeof import("@/app/pos/local/db"); Dexie: typeof import("dexie").default;
        } }).nativeTest;
        const native = window.indexedDB;
        const old = new db.PosLocalDatabase();
        await old.leads.put({ id: "existing", site_id: "site", name: "Retain" });
        old.close();
        if (mode !== "present") Reflect.deleteProperty(window, "indexedDB");
        if (mode === "webkit") {
          Reflect.set(Dexie.dependencies, "indexedDB", undefined);
          Object.defineProperty(window, "webkitIndexedDB", { value: native, configurable: true });
        }
        await db.preparePosStorage();
        const reopened = new db.PosLocalDatabase();
        await reopened.leads.put({ id: "new", site_id: "site", name: "Written" });
        reopened.close();
        const verify = new db.PosLocalDatabase();
        const names = (await verify.leads.toArray()).map((row) => row.name).sort();
        verify.close();
        let locked = false;
        try { db.getPosDb(); } catch { locked = true; }
        return { names, sameNative: window.indexedDB === native, locked };
      }, mode);
      expect(result).toEqual({ names: ["Retain", "Written"], sameNative: true, locked: true });
    });

    it.each(["missing", "denied", "broken"])("fails closed when native storage is %s", async (mode) => {
      const result = await page.evaluate(async (mode) => {
        const { db, Dexie } = (window as unknown as { nativeTest: {
          db: typeof import("@/app/pos/local/db"); Dexie: typeof import("dexie").default;
        } }).nativeTest;
        if (mode === "missing") {
          for (const key of ["indexedDB", "webkitIndexedDB", "mozIndexedDB", "msIndexedDB"]) Reflect.deleteProperty(window, key);
          Reflect.set(Dexie.dependencies, "indexedDB", undefined);
        } else if (mode === "denied") {
          Object.defineProperty(window, "indexedDB", { get() { throw new DOMException("Denied", "SecurityError"); }, configurable: true });
        } else {
          window.indexedDB.open = () => { throw new DOMException("Unavailable", "UnknownError"); };
        }
        return db.preparePosStorage().then(() => "unexpected success", (error) => error.name);
      }, mode);
      expect(result).toBe({ missing: "MissingAPIError", denied: "SecurityError", broken: "UnknownError" }[mode]);
    });
  });
});