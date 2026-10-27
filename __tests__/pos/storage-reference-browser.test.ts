/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser } from "playwright";
import ts from "typescript";

const suite = existsSync(webkit.executablePath()) ? describe : describe.skip;

suite("production Dexie missing-global diagnostics in isolated WebKit", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await webkit.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); });

  it.each(["indexedDB", "CustomEvent"])("identifies %s without clearing or replacing a database", async (missing) => {
    const page = await browser.newPage();
    try {
      await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Storage reference test</title>" }));
      await page.goto("https://pos.test/");
      await page.evaluate((name) => { Reflect.deleteProperty(window, name); }, missing);
      await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/dexie/dist/dexie.min.js") });
      const diagnostic = ts.transpileModule(readFileSync(path.join(process.cwd(), "app/pos/local/storage-diagnostic.ts"), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText;
      const result = await page.evaluate(async (source) => {
        const diagnostics = {} as typeof import("@/app/pos/local/storage-diagnostic");
        new Function("exports", source)(diagnostics);
        const Dexie = (window as unknown as { Dexie: typeof import("dexie").default }).Dexie;
        const db = new Dexie("isolated-reference-test");
        db.version(1).stores({ meta: "id" });
        try {
          await diagnostics.posStorageTask("DB_OPEN", async () => {
            try { await db.open(); } finally { db.close(); }
          });
          return "unexpected success";
        } catch (error) {
          return diagnostics.posStorageDiagnostic(error);
        }
      }, diagnostic);
      expect(result).toBe(`POS_STORAGE_REFERENCE:DB_OPEN:${missing.toUpperCase()}`);
    } finally { await page.close(); }
  });
});