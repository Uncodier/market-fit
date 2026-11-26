/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server"
import { chromium, webkit, type Browser } from "playwright"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import tailwindConfig from "@/tailwind.config"
import DirectoryLoading from "@/app/agents/loading"
import ProfileLoading from "@/app/agents/[id]/loading"
import ConnectorAccessLoading from "@/app/agents/[id]/connectors/loading"
import CommandLoading from "@/app/agents/[id]/[commandId]/loading"
import LogLoading from "@/app/agents/tools/[logId]/loading"
import { AgentChannelsSkeleton } from "@/app/components/agents/channel-skeletons"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

const markup = renderToStaticMarkup(<LocalizationProvider preferredLocale="es"><main>
  <DirectoryLoading /><ProfileLoading /><AgentChannelsSkeleton /><ConnectorAccessLoading /><CommandLoading /><LogLoading />
</main></LocalizationProvider>)

describe.each([{ name: 'Chromium', engine: chromium }, { name: 'WebKit', engine: webkit }])('responsive agent loading UI in $name', ({ engine }) => {
  let browser: Browser
  let css: string
  beforeAll(async () => {
    // Compile the actual TSX classes, not HTML-escaped versions of their nested selectors.
    css = (await postcss([tailwindcss({ ...tailwindConfig, content: [
      { raw: markup, extension: 'html' },
      'app/components/agents/{agent-loading-region,skeleton-components,channel-skeletons}.tsx',
      'app/agents/agent-detail-skeletons.tsx', 'app/components/ui/{section-card,skeleton}.tsx',
    ] })])
      .process('@tailwind base; @tailwind utilities;', { from: undefined })).css
    browser = await engine.launch({ headless: true })
  }, 30000)
  afterAll(async () => { await browser?.close() })

  it.each([320, 1280])('fits a %ipx viewport and honors reduced motion without hiding the shapes', async width => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', offline: true })
    try {
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html lang="es"><body>${markup}</body></html>`)
      await page.addStyleTag({ content: css })
      expect(await page.getByRole('status', { name: 'Cargando...' }).count()).toBe(6)
      const geometry = await page.evaluate(() => {
        const shapes = [...document.querySelectorAll<HTMLElement>('.animate-pulse')].filter(el => el.offsetWidth > 0)
        return { pageWidth: document.documentElement.scrollWidth, visible: shapes.length,
          animated: shapes.filter(el => getComputedStyle(el).animationName !== 'none').length,
          overflowing: shapes.filter(el => el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1).length }
      })
      expect(geometry.visible).toBeGreaterThan(25)
      expect(geometry).toMatchObject({ pageWidth: width, animated: 0, overflowing: 0 })
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      expect(await page.locator('.animate-pulse').first().evaluate(el => getComputedStyle(el).animationName)).toBe('pulse')
    } finally { await context.close() }
  })
})