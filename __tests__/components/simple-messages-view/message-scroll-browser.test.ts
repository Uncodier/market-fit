/** @jest-environment node */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { chromium, webkit, type Browser, type BrowserContext, type Page } from 'playwright'
import ts from 'typescript'
import type { MessageScrollBrowserHarness } from './message-scroll-browser-harness'

type Snapshot = ReturnType<MessageScrollBrowserHarness['snapshot']>
const root = path.resolve(__dirname, '../../..')
const hookImport = '../../../app/components/simple-messages-view/use-message-scroll'

function transpile(file: string) {
  return ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  }).outputText
}

function browserScript() {
  // Load installed production React/ReactDOM, not Jest's runtime or hook stubs.
  // The allowlisted CommonJS loader fails closed on any new runtime dependency.
  const productionModule = (name: string, file: string) => readFileSync(
    path.join(path.dirname(require.resolve(`${name}/package.json`)), 'cjs', file), 'utf8',
  )
  const sources = {
    react: productionModule('react', 'react.production.js'),
    'react-dom': productionModule('react-dom', 'react-dom.production.js'),
    'react-dom/client': productionModule('react-dom', 'react-dom-client.production.js'),
    scheduler: productionModule('scheduler', 'scheduler.production.js'),
    [hookImport]: transpile(path.join(root, 'app/components/simple-messages-view/use-message-scroll.ts')),
    harness: transpile(path.join(__dirname, 'message-scroll-browser-harness.tsx')),
  }
  return `(() => {
    const sources = ${JSON.stringify(sources)};
    const cache = Object.create(null);
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

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <title>Offline message scroll regression</title><style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px sans-serif; overflow: hidden; }
    main { position: relative; height: 100vh; padding: 20px; }
    #messages { height: calc(100vh - 160px); overflow-y: auto; overflow-x: hidden;
      overflow-anchor: none; overscroll-behavior: none; transform: translateZ(0); }
    .message { height: 64px; padding: 16px; border-bottom: 1px solid #ddd; }
    #composer { position: absolute; bottom: 20px; height: 100px; width: 300px; }
    #latest { display: block; height: 32px; }
  </style></head><body><div id="root"></div></body></html>`

// Real frames allow scroll dispatch, ResizeObserver, and React effects to settle.
// Sampling every frame also catches a temporary snap that a final-only assertion misses.
async function sampleFrames(page: Page, count = 12): Promise<Snapshot[]> {
  return page.evaluate(async count => {
    const samples = []
    for (let i = 0; i < count; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      samples.push(window.messageScrollTest.snapshot())
    }
    return samples
  }, count)
}

async function snapshot(page: Page) {
  return page.evaluate(() => window.messageScrollTest.snapshot())
}

async function wheel(page: Page, delta: number) {
  const before = await snapshot(page)
  await page.locator('#messages').hover({ position: { x: 200, y: 200 } })
  await page.mouse.wheel(0, delta)
  await page.waitForFunction(count => window.messageScrollTest.snapshot().wheelDeltas.length > count,
    before.wheelDeltas.length)
  return sampleFrames(page)
}

function expectDetached(samples: Snapshot[], top: number, latest = true) {
  expect(samples.every(sample => Math.abs(sample.top - top) <= 1)).toBe(true)
  expect(samples.every(sample => sample.gap > 0 && sample.latest === latest)).toBe(true)
}

describe.each([
  { name: 'Chromium', engine: chromium },
  { name: 'WebKit', engine: webkit },
])('message scroll hooks in real $name (offline, no server)', ({ engine }) => {
  let browser: Browser
  let context: BrowserContext
  let page: Page
  let script: string
  let errors: string[]
  let requests: string[]

  beforeAll(async () => {
    if (!existsSync(engine.executablePath())) throw new Error(`Installed browser missing: ${engine.executablePath()}`)
    script = browserScript()
    browser = await engine.launch({ headless: true })
  }, 30_000)
  afterAll(async () => { await browser?.close() })
  beforeEach(async () => {
    errors = []
    requests = []
    context = await browser.newContext({ viewport: { width: 900, height: 700 }, offline: true, serviceWorkers: 'block' })
    await context.route('**/*', async route => {
      requests.push(route.request().url())
      await route.abort()
    })
    page = await context.newPage()
    page.setDefaultTimeout(3_000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    // about:blank + in-memory markup/scripts: no host, navigation, or backend mocks.
    await page.setContent(html)
    await page.addScriptTag({ content: script })
    await page.waitForFunction(() => Boolean(window.messageScrollTest))
    await sampleFrames(page, 4)
    const initial = await snapshot(page)
    expect(initial.height).toBeGreaterThan(initial.viewport + 1000)
    expect(initial.gap).toBeLessThanOrEqual(1)
    expect(initial.latest).toBe(false)
  })
  afterEach(async () => {
    try {
      if (page && !page.isClosed()) {
        await page.evaluate(() => window.messageScrollTest?.dispose())
      }
    } finally {
      await context?.close()
    }
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })

  it.each([32, 240])('keeps a native wheel-up of %ipx detached through streaming rerenders and async growth', async delta => {
    const initial = await snapshot(page)
    await page.evaluate(() => window.messageScrollTest.startRerenders())
    await wheel(page, -delta)
    const detached = await snapshot(page)
    expect(detached.wheelDeltas).toContain(-delta)
    expect(initial.top - detached.top).toBeGreaterThan(1)
    expect(Math.abs(initial.top - detached.top - delta)).toBeLessThanOrEqual(1)
    // A small upward gesture detaches even within the button's 80px threshold.
    expect(detached.latest).toBe(delta > 80)
    expect(detached.commits).toBeGreaterThan(initial.commits + 5)
    expectDetached(await sampleFrames(page), detached.top, delta > 80)

    await page.evaluate(() => window.messageScrollTest.append())
    const afterAppend = await sampleFrames(page)
    expect(afterAppend.at(-1)!.height).toBeGreaterThan(detached.height)
    expectDetached(afterAppend, detached.top)
    await page.evaluate(() => window.messageScrollTest.stopRerenders())
    await sampleFrames(page, 4)
    const beforeGrowth = await snapshot(page)
    await page.evaluate(() => window.messageScrollTest.growAsync(180))
    const afterGrowth = await sampleFrames(page)
    expect(afterGrowth.at(-1)!.height).toBe(beforeGrowth.height + 180)
    expectDetached(afterGrowth, detached.top)
    expect(afterGrowth.at(-1)!.commits).toBe(beforeGrowth.commits)
  }, 15_000)

  it('hides Latest after manually wheeling to the bottom and resumes following', async () => {
    await wheel(page, -240)
    expect((await snapshot(page)).latest).toBe(true)
    const returned = (await wheel(page, 2000)).at(-1)!
    expect(returned.wheelDeltas).toEqual([-240, 2000])
    expect(returned.gap).toBeLessThanOrEqual(1)
    expect(returned.latest).toBe(false)
    await page.evaluate(() => window.messageScrollTest.append())
    await page.evaluate(() => window.messageScrollTest.growAsync(160))
    const following = (await sampleFrames(page)).at(-1)!
    expect(following.height).toBeGreaterThan(returned.height)
    expect(following.gap).toBeLessThanOrEqual(1)
    expect(following.latest).toBe(false)
  }, 15_000)

  it('recalculates Latest on viewport resize without pulling a detached reader back', async () => {
    await wheel(page, -220)
    const detached = await snapshot(page)
    expect(detached.latest).toBe(true)
    expect(detached.gap).toBeGreaterThan(180)
    // The larger viewport moves within the 80px threshold without clamping top.
    await page.setViewportSize({ width: 900, height: 880 })
    const expanded = (await sampleFrames(page)).at(-1)!
    expect(Math.abs(expanded.top - detached.top)).toBeLessThanOrEqual(1)
    expect(expanded.gap).toBeGreaterThan(0)
    expect(expanded.gap).toBeLessThanOrEqual(80)
    expect(expanded.latest).toBe(false)
    await page.setViewportSize({ width: 900, height: 700 })
    const contracted = (await sampleFrames(page)).at(-1)!
    expect(Math.abs(contracted.top - detached.top)).toBeLessThanOrEqual(1)
    expect(contracted.gap).toBeGreaterThan(80)
    expect(contracted.latest).toBe(true)
    await page.evaluate(() => window.messageScrollTest.rerender())
    expectDetached(await sampleFrames(page), detached.top)
  }, 15_000)
})