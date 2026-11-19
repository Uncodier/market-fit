/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import os from "node:os"
import path from "node:path"
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright"
import ts from "typescript"
import { PartnerSupportChannelSetup } from "@/app/components/settings/PartnerSupportChannelSetup"

jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => () => {} }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))

const root = path.resolve(__dirname, "../../..")
const target = "https://example.test/authorization"
const setupMarkup = renderToStaticMarkup(React.createElement(PartnerSupportChannelSetup, {
  type: "whatsapp", status: "pending", invitationUrl: target,
  connecting: false, checking: false, onConnect: () => {}, onCheck: async () => {},
}))
const source = ts.transpileModule(readFileSync(path.join(root, "app/components/settings/partner-setup-window.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const script = `(() => {
  const exports = {};
  new Function('exports', ${JSON.stringify(source)})(exports);
  document.querySelector('a').onclick = event => {
    const opened = exports.openPartnerSetupFromClick(event);
    document.body.dataset.continued = String(opened);
  };
  document.getElementById('connect').onclick = () => {
    const popup = exports.reservePartnerSetupWindow();
    document.body.dataset.reserved = String(Boolean(popup));
    document.body.dataset.isolated = String(popup && popup.opener === null);
    setTimeout(() => {
      document.body.dataset.navigated = String(exports.navigatePartnerSetupWindow(popup, ${JSON.stringify(target)}));
    }, 80);
  };
})();`

const engines = [
  { name: "WebKit", type: webkit, executablePath: existsSync(webkit.executablePath()) ? webkit.executablePath()
    : path.join(os.homedir(), "Library/Caches/ms-playwright/webkit-2287/pw_run.sh") },
  { name: "Chromium", type: chromium,
    executablePath: path.join(root, ".playwright-browsers/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing") },
]

for (const engine of engines) {
  const suite = existsSync(engine.executablePath) ? describe : describe.skip
  suite(`partner setup navigation in ${engine.name}`, () => {
    let browser: Browser
    let context: BrowserContext
    let page: Page
    let requests: string[]

    beforeAll(async () => {
      browser = await engine.type.launch({ headless: true, executablePath: engine.executablePath })
    }, 20_000)
    afterAll(async () => { await browser?.close() })
    beforeEach(async () => {
      requests = []
      context = await browser.newContext()
      // Static navigation destination only. No API/provider calls or user data.
      await context.route("**/*", async route => {
        const url = route.request().url()
        requests.push(url)
        if (url !== target) return route.abort()
        return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Authorization destination</h1>" })
      })
      page = await context.newPage()
      page.setDefaultTimeout(4_000)
      await page.setContent(`<button id="connect">Connect Account</button>${setupMarkup}`)
      await page.addScriptTag({ content: script })
    })
    afterEach(async () => {
      await context?.close()
      expect(requests.every(url => url === target)).toBe(true)
    })

    it("reserves an isolated tab during the native click and navigates it after async work", async () => {
      const popupReady = page.waitForEvent("popup")
      await page.getByRole("button", { name: "Connect Account" }).click()
      const popup = await popupReady
      await popup.waitForURL(target)
      expect(await page.locator("body").getAttribute("data-reserved")).toBe("true")
      expect(await page.locator("body").getAttribute("data-isolated")).toBe("true")
      expect(await page.locator("body").getAttribute("data-navigated")).toBe("true")
      expect(await popup.evaluate(() => window.opener)).toBeNull()
      expect(await popup.getByRole("heading").textContent()).toBe("Authorization destination")
      expect(requests).toEqual([target])
    })

    it("opens Continue Setup in a separate window without changing the settings document", async () => {
      const originalUrl = page.url()
      expect(await page.getByRole("link", { name: "Continue Setup" }).locator(".btn-glass-surface").count()).toBe(1)
      const popupReady = page.waitForEvent("popup")
      await page.getByRole("link", { name: "Continue Setup" }).click()
      const popup = await popupReady
      await popup.waitForURL(target)
      expect(await popup.evaluate(() => window.opener)).toBeNull()
      expect(page.url()).toBe(originalUrl)
      expect(await page.locator("body").getAttribute("data-continued")).toBe("true")
      expect(context.pages()).toHaveLength(2)
      expect(requests).toEqual([target])
    })

    it("keeps the settings document intact when the requested popup is blocked", async () => {
      const originalUrl = page.url()
      await page.evaluate(() => { window.open = () => null })
      await page.getByRole("link", { name: "Continue Setup" }).click()
      expect(await page.locator("body").getAttribute("data-continued")).toBe("false")
      expect(page.url()).toBe(originalUrl)
      expect(context.pages()).toHaveLength(1)
      expect(requests).toEqual([])
    })

    it("leaves modified clicks uncancelled without requesting a script popup", async () => {
      const originalUrl = page.url()
      await page.evaluate(() => {
        window.open = () => { document.body.dataset.unexpectedPopup = "true"; return null }
        document.addEventListener("click", event => {
          document.body.dataset.cancelled = String(event.defaultPrevented)
        })
      })
      await page.getByRole("link", { name: "Continue Setup" }).click({ modifiers: ["ControlOrMeta"] })
      // Headless macOS engines do not reproduce native background-tab shortcuts.
      expect(await page.locator("body").getAttribute("data-continued")).toBe("undefined")
      expect(await page.locator("body").getAttribute("data-cancelled")).toBe("false")
      expect(await page.locator("body").getAttribute("data-unexpected-popup")).toBeNull()
      expect(page.url()).toBe(originalUrl)
    })
  })
}