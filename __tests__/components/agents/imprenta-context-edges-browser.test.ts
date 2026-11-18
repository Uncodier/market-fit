/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"
import { chromium, webkit, type Browser, type Page } from "playwright"
import ts from "typescript"
import type { ContextEdgesBrowserHarness } from "./imprenta-context-edges-browser-harness"

declare global { interface Window { contextEdgesTest: ContextEdgesBrowserHarness } }
const root = path.resolve(__dirname, "../../..")

function transpile(file: string) {
  return ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
}

function browserScript() {
  const production = (name: string, file: string) => readFileSync(path.join(path.dirname(require.resolve(`${name}/package.json`)), "cjs", file), "utf8")
  const sources: Record<string, string> = {
    react: production("react", "react.production.js"),
    "react/jsx-runtime": production("react", "react-jsx-runtime.production.js"),
    "react-dom": production("react-dom", "react-dom.production.js"),
    "react-dom/client": production("react-dom", "react-dom-client.production.js"),
    scheduler: production("scheduler", "scheduler.production.js"),
    harness: transpile(path.join(__dirname, "imprenta-context-edges-browser-harness.tsx")),
  }
  for (const name of ["geometry", "hit", "interaction", "paint", "clip"]) {
    sources[`./imprenta-context-edges-${name}`] = transpile(path.join(root, `app/components/agents/imprenta-context-edges-${name}.ts`))
  }
  sources["./imprenta-publish-relations"] = transpile(path.join(root, "app/components/agents/imprenta-publish-relations.ts"))
  sources["@/app/components/agents/imprenta-context-edges-canvas"] = transpile(path.join(root, "app/components/agents/imprenta-context-edges-canvas.tsx"))
  for (const name of ["viewport", "hover", "drag"]) {
    sources[`@/app/lib/imprenta-${name}-store`] = transpile(path.join(root, `app/lib/imprenta-${name}-store.ts`))
  }
  // Actual installed React and production component, with a closed local module
  // allowlist. No app server, auth, network requests, or backend response mocks.
  return `(() => {
    const sources = ${JSON.stringify(sources)}, cache = Object.create(null);
    function require(name) {
      if (!Object.prototype.hasOwnProperty.call(sources, name)) throw new Error('Unexpected import: ' + name);
      if (cache[name]) return cache[name].exports;
      const module = cache[name] = { exports: {} };
      new Function('module', 'exports', 'require', sources[name])(module, module.exports, require);
      return module.exports;
    }
    require('harness');
  })();`
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  :root { --primary: 222 84% 52%; } body { margin: 0; } #root { margin: 50px 40px; }
  #control { width: 100px; height: 22px; } #card { background: #eee; }
  #relation-control { background: #eee; }
</style></head><body><div id="root"></div></body></html>`
const frames = (page: Page) => page.evaluate(async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
})

describe.each([{ name: "Chromium", engine: chromium }, { name: "WebKit", engine: webkit }])(
  "offline context edge component in $name", ({ engine }) => {
    let browser: Browser
    beforeAll(async () => { browser = await engine.launch({ headless: true }) }, 30_000)
    afterAll(async () => { await browser?.close() })

    it("paints endpoint-offscreen crossings and hits at every zoom without static repaint on highlights", async () => {
      const context = await browser.newContext({ viewport: { width: 900, height: 720 }, offline: true, deviceScaleFactor: 2 })
      const page = await context.newPage()
      const requests: string[] = [], errors: string[] = []
      await context.route("**/*", async route => { requests.push(route.request().url()); await route.abort() })
      page.on("pageerror", error => errors.push(error.message))
      try {
        await page.setContent(html)
        await page.addScriptTag({ content: browserScript() })
        await frames(page)
        const snapshot = () => page.evaluate(() => window.contextEdgesTest.snapshot())
        const first = await snapshot()
        expect(first.pixels).toBe(true)
        expect(first.bitmaps).toEqual([[1600, 1200], [1600, 1200]])
        for (const scale of [.001, .01, .05, .2, .4, .7, 1, 2, 8]) {
          const beforeZoom = await snapshot()
          await page.evaluate(scale => window.contextEdgesTest.zoom(scale), scale)
          await frames(page)
          const zoomed = await snapshot()
          expect(zoomed.commits).toBe(beforeZoom.commits)
          expect(zoomed.pixels).toBe(true)
          const paints = zoomed.paints.static
          await page.evaluate(() => window.contextEdgesTest.hover("source-0"))
          await frames(page)
          expect((await snapshot()).paints.static).toBe(paints)
          expect((await snapshot()).commits).toBe(zoomed.commits)
          // Viewport offset (40,50), constant nine CSS pixels from the curve.
          await page.mouse.click(440, 359)
          await frames(page)
          const clicked = await snapshot()
          expect(clicked.selections.length).toBe(zoomed.selections.length + 1)
          expect(clicked.paints.static).toBe(paints)
          await page.mouse.click(440, 361) // Eleven pixels is outside at every scale/DPR.
          await frames(page)
          expect((await snapshot()).selections.length).toBe(clicked.selections.length)
          await page.evaluate(() => window.contextEdgesTest.hover(null))
        }
        expect(await page.locator("svg").count()).toBe(0)
        expect(errors).toEqual([])
        expect(requests).toEqual([])
      } finally { await context.close() }
    }, 30_000)

    it("lets DOM controls and later node ownership win and rejects drag/pan excursions", async () => {
      const context = await browser.newContext({ viewport: { width: 900, height: 720 }, offline: true })
      const page = await context.newPage()
      try {
        await context.route("**/*", route => route.abort())
        await page.setContent(html)
        await page.addScriptTag({ content: browserScript() })
        await frames(page)
        const snapshot = () => page.evaluate(() => window.contextEdgesTest.snapshot())
        await page.locator("#control").click()
        await page.mouse.click(100, 350) // Mounted DOM card on the curve.
        await page.mouse.click(250, 350) // Existing relation control.
        await page.mouse.click(680, 350) // Later native node pointerdown prevents default.
        expect((await snapshot()).nodeHits).toBe(1)
        expect((await snapshot()).controlHits).toBe(1)
        expect((await snapshot()).selections).toEqual([])
        const panBefore = (await snapshot()).panStarts
        await page.mouse.move(440, 350)
        await page.mouse.down()
        await page.mouse.move(446, 350)
        await page.mouse.move(440, 350)
        await page.mouse.up()
        expect((await snapshot()).selections).toEqual([])
        expect((await snapshot()).panStarts).toBeGreaterThan(panBefore)
        await page.mouse.click(440, 350)
        await frames(page)
        expect((await snapshot()).selections).toEqual([{ id: "edge-0", anchor: { x: 440, y: 350 } }])
        await page.mouse.click(440, 350)
        await frames(page)
        expect((await snapshot()).selections.at(-1)?.id).toBeNull()
        await page.evaluate(() => window.contextEdgesTest.dispose())
        await page.mouse.click(440, 350)
        expect(await page.locator("canvas").count()).toBe(0)
      } finally { await context.close() }
    }, 20_000)
  },
)