/** @jest-environment node */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { chromium, webkit } from "playwright"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { ConnectorDomainsSidebar } from "@/app/connectors/connector-domains"
import tailwindConfig from "@/tailwind.config"
import { translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))

const fixture = renderToStaticMarkup(<ConnectorDomainsSidebar
  domains={[
    { id: "ai", label: "Artificial Intelligence", skill_slugs: [] },
    { id: "crm", label: "Sales & CRM", skill_slugs: [] },
  ]}
  domainCounts={{ total: 120, counts: { ai: 17, crm: 0 } }}
  loading={false}
  selected=""
  onSelect={() => {}}
/>)

it.each([
  { name: "Chromium", engine: chromium, htmlClass: "", viewport: 1280 },
  { name: "WebKit", engine: webkit, htmlClass: "safari", viewport: 390 },
])("aligns the icon and title left and the count right in $name", async ({ engine, htmlClass, viewport }) => {
  const css = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8")
  const { css: globalCss } = await postcss([tailwindcss({
    ...tailwindConfig,
    content: [{ raw: fixture, extension: "html" }],
  })]).process(css("app/globals.css"), { from: undefined })
  const browser = await engine.launch()
  try {
    const page = await browser.newPage({ viewport: { width: viewport, height: 720 }, offline: true })
    const content = viewport < 768
      ? `<div role="dialog" style="width: 280px">${fixture}</div>`
      : fixture
    await page.setContent(`<!doctype html><html class="${htmlClass}"><body>${content}</body></html>`)
    await page.addStyleTag({ content: globalCss + css("app/safari-fix.css") + css("app/styles/mobile-primary-buttons.css") })
    // Use the shared row markup within a mobile dialog without opening a Radix portal.
    if (viewport < 768) await page.addStyleTag({ content: '[role="dialog"] aside { display: block; width: 100%; max-width: none; }' })
    const rows = await page.locator("li > button").evaluateAll(buttons => buttons.map(button => {
      const row = button.getBoundingClientRect()
      const icon = button.querySelector("svg")!.getBoundingClientRect()
      const title = button.querySelector(".truncate")!.getBoundingClientRect()
      const count = button.querySelector(".tabular-nums")!.getBoundingClientRect()
      return { leftInset: icon.left - row.left, gap: title.left - icon.right, rightInset: row.right - count.right }
    }))
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.leftInset).toBeCloseTo(10.8, 1)
      expect(row.gap).toBeCloseTo(8, 1)
      expect(row.rightInset).toBeCloseTo(10.8, 1)
    }
  } finally {
    await browser.close()
  }
}, 20_000)