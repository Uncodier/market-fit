/** @jest-environment node */
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import path from "node:path"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { chromium, webkit, type Browser } from "playwright"
import { Button } from "@/app/components/ui/button"
import { Menu, Plus } from "@/app/components/ui/icons"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import tailwindConfig from "@/tailwind.config"

jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({
  useBtnGlassMotion: () => jest.fn(),
}))
jest.mock("@/app/context/PermissionContext", () => ({
  useOptionalPermissions: () => null,
}))

const fixture = renderToStaticMarkup(<main>
  <header data-topbar className="flex h-[64px] items-center justify-between px-4 lg:px-8 w-full max-w-full">
    <div className="flex-1 min-w-0 pr-4"><h1 className="truncate">Sales opportunities</h1></div>
    <div data-topbar-actions className="flex items-center gap-2 sm:gap-4">
      <Button aria-label="Create deal" className="!h-9 !w-9 !p-0 !min-w-0 aspect-square">
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline ml-2">Create deal</span>
      </Button>
      <TopBarPrimaryActionsSlot />
    </div>
  </header>
  <div data-topbar>
    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Open menu" aria-controls="workspace-sidebar">
      <Menu className="topbar-menu-icon" />
    </Button>
  </div>
  <section aria-label="Page actions">
    <Button tint="whatsapp" className="w-full neu-auth-whatsapp-btn">
      <Plus className="mr-2 h-4 w-4" />
      <span>Use Makinari on WhatsApp</span>
    </Button>
    <Button>Sign In</Button>
    <Button aria-disabled="true">Unavailable</Button>
  </section>
  <div data-page-primary-actions>
    <Button disabled>Save</Button>
    <Button variant="secondary" aria-label="Secondary action"><Plus /></Button>
  </div>
</main>)

describe.each([
  { name: "Chromium", engine: chromium },
  { name: "WebKit", engine: webkit },
])("rendered mobile primary icons in $name (offline)", ({ engine, name }) => {
  let browser: Browser
  let globalCss: string
  const safariCss = readFileSync(path.join(process.cwd(), "app/safari-fix.css"), "utf8")
  const mobileCss = readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8")

  beforeAll(async () => {
    const result = await postcss([tailwindcss({
      ...tailwindConfig,
      content: [{ raw: fixture, extension: "html" }],
    })]).process(readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8"), { from: undefined })
    globalCss = result.css
    browser = await engine.launch({ headless: true })
  }, 30_000)

  afterAll(async () => { await browser?.close() })

  it.each([341, 390, 640, 767])("renders 28px icons centered in 48px targets at %ipx", async width => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, offline: true })
    try {
      await context.route("**/*", route => route.abort())
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html lang="en" class="${name === "WebKit" ? "safari" : ""}"><body>${fixture}</body></html>`)
      await page.addStyleTag({ content: globalCss })
      // Reverse the last two sheets too: the fix must not depend on import order.
      for (const reversed of [false, true]) {
        const styles = await page.addStyleTag({ content: reversed ? mobileCss + safariCss : safariCss + mobileCss })
        const actions = await page.locator("[data-topbar] .btn-primary:has(svg)").evaluateAll(buttons => buttons.map(button => {
          const box = button.getBoundingClientRect()
          const svg = button.querySelector("svg")!
          const icon = svg.getBoundingClientRect()
          const wrapper = button.querySelector(".safari-icon-fix")?.getBoundingClientRect()
          return {
            name: button.getAttribute("aria-label"),
            button: [box.width, box.height],
            svg: [icon.width, icon.height],
            wrapper: wrapper && [wrapper.width, wrapper.height],
            offset: [icon.x + icon.width / 2 - box.x - box.width / 2, icon.y + icon.height / 2 - box.y - box.height / 2],
            stroke: getComputedStyle(svg).strokeWidth,
          }
        }))
        expect(actions).toHaveLength(1)
        expect(actions.map(({ name, svg }) => ({ name, svg }))).toEqual([
          { name: "Create deal", svg: [28, 28] },
        ])
        for (const action of actions) {
          expect(action.button).toEqual([48, 48])
          if (action.wrapper) expect(action.wrapper).toEqual([28, 28])
          expect(action.offset[0]).toBeCloseTo(0)
          expect(action.offset[1]).toBeCloseTo(0)
          expect(action.stroke).toBe("1.5px")
        }
        const menuIcon = await page.getByRole("button", { name: "Open menu" }).locator("svg").evaluate(svg => {
          const { width, height } = svg.getBoundingClientRect()
          return { size: [width, height], stroke: getComputedStyle(svg).strokeWidth }
        })
        expect(menuIcon).toEqual({ size: actions[0].svg, stroke: actions[0].stroke })
        const spacing = await page.locator("header").evaluate(header => {
          const row = header.getBoundingClientRect()
          const button = header.querySelector(".btn-primary")!.getBoundingClientRect()
          const svg = header.querySelector("svg")!.getBoundingClientRect()
          return {
            left: header.querySelector("h1")!.getBoundingClientRect().left - row.left,
            right: row.right - button.right,
            vertical: [button.top - row.top, row.bottom - button.bottom],
            iconPadding: [svg.left - button.left, button.right - svg.right, svg.top - button.top, button.bottom - svg.bottom],
            slotDisplay: getComputedStyle(header.querySelector("[data-page-primary-actions]")!).display,
            circles: header.querySelectorAll("svg circle").length,
          }
        })
        expect(spacing).toEqual({ left: 16, right: 16, vertical: [8, 8], iconPadding: [10, 10, 10, 10], slotDisplay: "none", circles: 0 })
        const secondaryWidth = await page.getByRole("button", { name: "Secondary action" }).locator("svg").evaluate(svg => svg.getBoundingClientRect().width)
        expect(secondaryWidth).toBeLessThan(32)
        await page.getByRole("button", { name: "Create deal" }).waitFor({ state: "visible" })
        await styles.evaluate(style => style.parentNode?.removeChild(style))
      }
    } finally { await context.close() }
  }, 20_000)

  it.each([390, 768])("only strips topbar primary paint on mobile (%ipx)", async width => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, offline: true })
    try {
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html class="dark ${name === "WebKit" ? "safari" : ""}"><body>${fixture}</body></html>`)
      await page.addStyleTag({ content: globalCss + safariCss + mobileCss })
      const paint = (label: string) => page.getByRole("button", { name: label, exact: true }).evaluate(button => {
        const style = getComputedStyle(button)
        const glass = button.querySelector(".btn-glass-surface")
        return {
          background: style.backgroundColor,
          shadow: style.boxShadow,
          glass: glass ? getComputedStyle(glass).display : null,
          lights: ["::before", "::after"].map(pseudo => {
            const light = getComputedStyle(button, pseudo)
            return { display: light.display, filter: light.filter, background: light.backgroundImage }
          }),
        }
      })
      const transparent = "rgba(0, 0, 0, 0)"
      if (width < 768) {
        await page.getByRole("button", { name: "Create deal" }).hover()
        for (const label of ["Create deal", "Save"]) {
          const style = await paint(label)
          expect(style).toMatchObject({ background: transparent, shadow: "none", glass: "none" })
          expect(style.lights.map(light => light.display)).toEqual(["none", "none"])
        }
        expect((await paint("Unavailable")).lights.map(light => light.display)).toEqual(["none", "none"])
      } else {
        expect((await paint("Create deal")).background).not.toBe(transparent)
        expect((await paint("Save")).background).not.toBe(transparent)
      }
      expect((await paint("Secondary action")).background).not.toBe(transparent)
      for (const label of ["Sign In", "Use Makinari on WhatsApp"]) {
        const style = await paint(label)
        expect(style.background).not.toBe(transparent)
        expect(style.glass).not.toBe("none")
        if (width < 768) {
          for (const light of style.lights) {
            expect(light.display).not.toBe("none")
            expect(light.filter).toBe("blur(12px)")
            expect(light.background).toContain("radial-gradient")
          }
        }
      }
      const whatsapp = page.getByRole("button", { name: "Use Makinari on WhatsApp" })
      expect((await whatsapp.boundingBox())?.width).toBeGreaterThan(240)
      expect((await whatsapp.locator("span", { hasText: "Use Makinari on WhatsApp" }).boundingBox())?.width).toBeGreaterThan(100)
    } finally { await context.close() }
  })

  it("retains desktop icon sizing at the 768px breakpoint", async () => {
    const context = await browser.newContext({ viewport: { width: 768, height: 800 }, offline: true })
    try {
      await context.route("**/*", route => route.abort())
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html class="${name === "WebKit" ? "safari" : ""}"><body>${fixture}</body></html>`)
      await page.addStyleTag({ content: globalCss + safariCss })
      const originalWidth = await page.getByRole("button", { name: "Create deal" }).locator("svg").evaluate(svg => svg.getBoundingClientRect().width)
      await page.addStyleTag({ content: mobileCss })
      const width = await page.getByRole("button", { name: "Create deal" }).locator("svg").evaluate(svg => svg.getBoundingClientRect().width)
      expect(width).toBe(originalWidth)
      expect(width).toBeLessThan(32)
    } finally { await context.close() }
  })

  it("shows the primary slot only while populated and removes its trailing gap again", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, offline: true })
    try {
      await context.route("**/*", route => route.abort())
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html class="${name === "WebKit" ? "safari" : ""}"><body>${fixture}</body></html>`)
      await page.addStyleTag({ content: globalCss + safariCss + mobileCss })
      const populated = await page.locator("header").evaluate(header => {
        const slot = header.querySelector("[data-page-primary-actions]")!
        slot.appendChild(header.querySelector(".btn-primary-well")!.cloneNode(true))
        const first = header.querySelector(".btn-primary")!.getBoundingClientRect()
        const second = slot.querySelector(".btn-primary")!.getBoundingClientRect()
        return { display: getComputedStyle(slot).display, gap: second.left - first.right, right: header.getBoundingClientRect().right - second.right }
      })
      expect(populated).toEqual({ display: "flex", gap: 8, right: 16 })
      const empty = await page.locator("header").evaluate(header => {
        const slot = header.querySelector("[data-page-primary-actions]")!
        slot.replaceChildren()
        return { display: getComputedStyle(slot).display, right: header.getBoundingClientRect().right - header.querySelector(".btn-primary")!.getBoundingClientRect().right }
      })
      expect(empty).toEqual({ display: "none", right: 16 })
    } finally { await context.close() }
  })
})