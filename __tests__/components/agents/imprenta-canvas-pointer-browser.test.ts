/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"
import { chromium, webkit, type Browser } from "playwright"
import ts from "typescript"
import type { bindCanvasPointerInteraction } from "@/app/components/agents/imprenta-nodes-canvas-interaction"

declare global {
  interface Window {
    exports: { bindCanvasPointerInteraction: typeof bindCanvasPointerInteraction }
    pointerTest: {
      state: { node: number; background: number; pan: number; card: number; control: number }
      cleanup: () => void
    }
  }
}

// Exercise the production native event adapter with the same sibling structure
// as ZoomableCanvas. In-memory DOM only: no server, auth, or backend responses.
const adapterFile = path.resolve(__dirname, "../../../app/components/agents/imprenta-nodes-canvas-interaction.ts")
const adapterScript = ts.transpileModule(readFileSync(adapterFile, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText

describe.each([{ name: "Chromium", engine: chromium }, { name: "WebKit", engine: webkit }])(
  "Imprenta delegated pointers in local $name", ({ engine }) => {
    let browser: Browser
    beforeAll(async () => { browser = await engine.launch({ headless: true }) }, 30_000)
    afterAll(async () => { await browser?.close() })

    it("lets DOM controls receive real clicks, reserves lite hits, and preserves background pan", async () => {
      const context = await browser.newContext({ viewport: { width: 800, height: 600 }, offline: true })
      const requests: string[] = []
      const errors: string[] = []
      await context.route("**/*", async route => { requests.push(route.request().url()); await route.abort() })
      const page = await context.newPage()
      page.on("pageerror", error => errors.push(error.message))
      try {
        await page.setContent(`<!doctype html><style>
          body { margin: 0; }
          #viewport { isolation: isolate; position: relative; width: 800px; height: 600px; cursor: grab; }
          #content { position: absolute; z-index: 2; transform: scale(.5); transform-origin: 0 0; }
          #card { position: absolute; left: 40px; top: 40px; width: 400px; height: 200px; background: white; }
          button { width: 160px; height: 60px; } input { display: block; width: 180px; height: 40px; }
          #front { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
          canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        </style><div id="viewport" style="isolation: isolate"><div id="content"><div id="card" data-node-id="mounted">
          <button id="control"><svg width="20" height="20"><circle cx="10" cy="10" r="8" /></svg>Action</button>
          <input id="editor" aria-label="Editor" />
        </div></div><div id="relation" data-imprenta-context-control style="position:absolute;left:250px;top:20px;width:60px;height:30px;z-index:2">Relation</div>
        <svg style="position:absolute;left:250px;top:70px;width:60px;height:40px;z-index:2"><g data-imprenta-context-control><path id="edge" d="M0 20 L60 20" stroke="black" stroke-width="20" /></g></svg>
        <div id="front"><canvas></canvas></div></div>`)
        await page.addScriptTag({ content: `window.exports = {}; ${adapterScript}` })
        await page.evaluate(() => {
          const state = { node: 0, background: 0, pan: 0, card: 0, control: 0 }
          const viewport = document.getElementById("viewport")!
          // ZoomableCanvas pans via compatibility mousedown. Node ownership must
          // prevent it, but empty-space pointerdown must not suppress it.
          viewport.addEventListener("mousedown", () => { state.pan++ })
          document.getElementById("card")!.addEventListener("mousedown", event => {
            state.card++
            event.stopPropagation()
          })
          document.getElementById("control")!.addEventListener("click", () => { state.control++ })
          const cleanup = window.exports.bindCanvasPointerInteraction(document.querySelector("canvas")!, {
            enabled: () => true,
            // Includes the DOM card deliberately: native targets must win over
            // even an overlapping canvas hit. The isolated lite hit is at 350,50.
            hitTest: (x: number, y: number) => x < 400 && y < 130 ? "lite" : null,
            onNodePointerDown: (_id: string, event: PointerEvent) => {
              state.node++
              event.preventDefault()
              event.stopPropagation()
            },
            onBackgroundPointerDown: () => { state.background++ },
          })
          ;window.pointerTest = { state, cleanup }
        })
        const state = () => page.evaluate(() => ({ ...window.pointerTest.state }))
        await page.locator("#control svg").click()
        await page.locator("#editor").click()
        await page.keyboard.type("Editable")
        expect(await page.locator("#editor").inputValue()).toBe("Editable")
        expect(await state()).toEqual({ node: 0, background: 0, pan: 0, card: 2, control: 1 })
        await page.mouse.click(200, 100) // Bare mounted-card surface.
        expect((await state()).card).toBe(3)
        await page.mouse.click(275, 35)
        await page.mouse.click(275, 90)
        expect((await state()).node).toBe(0)
        // The surrounding application decides relation selection/pan; the
        // canvas adapter must not claim either native relation target.
        await page.evaluate(() => { window.pointerTest.state.pan = 0 })
        await page.mouse.click(350, 50) // Canvas-only node: no compatibility pan.
        expect(await state()).toEqual({ node: 1, background: 0, pan: 0, card: 3, control: 1 })
        await page.mouse.move(600, 300)
        await page.mouse.down()
        await page.mouse.move(650, 350)
        await page.mouse.up()
        expect(await state()).toEqual({ node: 1, background: 1, pan: 1, card: 3, control: 1 })
        await page.evaluate(() => window.pointerTest.cleanup())
        await page.mouse.click(350, 50)
        expect((await state()).node).toBe(1)
        expect((await state()).pan).toBe(2)
        expect(errors).toEqual([])
        expect(requests).toEqual([])
      } finally { await context.close() }
    }, 20_000)
  }
)