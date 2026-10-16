/** @jest-environment node */

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { chromium } from "playwright"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import tailwindConfig from "@/tailwind.config"
import { ShopPendingGrid } from "@/app/shop/[siteSlug]/ShopPendingGrid"
import { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"
import { commerceProductGridClassName } from "@/app/components/commerce/CommerceProductGrid"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { DisplayCurrencyProvider } from "@/app/context/DisplayCurrencyContext"
import { shopItem } from "./catalog-fixture"

const root = process.cwd()
const bundledBrowser = path.join(root, ".playwright-browsers/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
const executablePath = existsSync(bundledBrowser) ? bundledBrowser : chromium.executablePath()
const browserTest = existsSync(executablePath) ? it : it.skip
const totalCount = 31
const longTitle = "Handcrafted seasonal collection with a very long two-line product title and more details"
const longDescription = "**Freshly prepared** with seasonal ingredients. ".repeat(12)
const labels = ["Extra large handcrafted edition", "Limited seasonal finish", "Custom gift packaging", "Fourth option", "Fifth option"]
const buyers = ["Alice Taylor", "Morgan Smith", "Casey Brown", "Jamie Wilson"].map((name, index) => ({
  id: `buyer-${index}`, name, avatar_url: null,
}))
const pixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

// Use the actual listing and real localization/currency providers in SSR: effects
// never execute, so no FX, image-generation, catalog, or backend calls are made.
function productMarkup(index: number, compactMobile: boolean, stableLayout = true) {
  const scenario = index % 8
  const item = {
    ...shopItem(`product-${index}`, "Collection"),
    name: scenario === 0 ? "Tea" : scenario === 6 ? "UnbrokenProductName".repeat(10) : longTitle,
    description: scenario === 0 ? undefined : longDescription,
    image_url: pixel,
    target_sale_price: scenario === 6 ? 123456789012345 : 24.5,
    currency: scenario === 6 ? "EUR" : "USD",
    is_recurring: scenario === 4,
    is_reservation: scenario === 5,
    is_dynamic_price: scenario === 6,
    lowest_sale_price: scenario === 6 ? 123456789012345 : undefined,
    kind: scenario === 7 ? "digital_asset" as const : "product" as const,
    digital_subtype: scenario === 7 ? "ticket" as const : undefined,
    site: { id: "site", name: "The very long seasonal collection seller name" },
    metadata: {
      show_available_inventory: scenario >= 2,
      show_buyers: scenario === 3 || scenario === 4,
    },
    _shop: {
      sellable: scenario !== 7,
      availableQty: scenario === 7 ? 0 : scenario >= 2 ? 2 : undefined,
      nextSlotAvailable: scenario === 5 ? 3 : undefined,
      buyers,
      buyerCount: 123456789,
      variantLabels: scenario === 1 || scenario === 3 ? labels : undefined,
    },
  }
  return renderToStaticMarkup(
    <LocalizationProvider preferredLocale={scenario === 5 ? "fr" : "en"}>
      <DisplayCurrencyProvider>
        <CatalogListingCard
          item={item}
          href={`/shop/test/${item.id}`}
          onPrimaryAction={() => {}}
          compactMobile={compactMobile}
          stableLayout={stableLayout}
          showSeller={scenario === 2}
          descriptionLineClamp={scenario === 4 ? "line-clamp-1" : scenario === 7 ? "none" : "line-clamp-2"}
          isOwned={scenario === 7}
          primaryDisabled={scenario === 7}
          disabledLabel="This product is currently unavailable"
          promoBadge={scenario === 3 ? { promotionId: "promo", href: "/shop/test/promo", label: "Seasonal offer" } : null}
        />
      </DisplayCurrencyProvider>
    </LocalizationProvider>,
  )
}

async function layoutCss() {
  const css = await postcss([tailwindcss({
    ...tailwindConfig,
    content: [
      "CommerceProductGrid.tsx", "CatalogListingCard.tsx", "CatalogListingCardSkeleton.tsx",
      "StorefrontListingMerch.tsx", "BuyerAvatarStack.tsx", "ProgressiveImage.tsx",
    ].map((file) => path.join(root, "app/components/commerce", file)).concat([
      path.join(root, "app/components/ui/skeleton.tsx"),
      path.join(root, "app/components/ui/avatar.tsx"),
    ]),
  })]).process("@tailwind base; @tailwind utilities;", { from: undefined })
  // Jest maps module selectors to identity names; load their real declarations.
  return css.css + "\n" + [
    "app/shop/[siteSlug]/shop-pending-grid.module.css",
    "app/components/commerce/catalog-listing-stable-layout.module.css",
  ].map((file) => readFileSync(path.join(root, file), "utf8")).join("\n")
}

it("keeps default skeleton markup unchanged outside stable Shop categories", () => {
  for (const compactMobile of [false, true]) {
    for (const showSeller of [false, true]) {
      const defaults = renderToStaticMarkup(<CatalogListingCardSkeleton {...{ compactMobile, showSeller }} />)
      expect(defaults).toBe(renderToStaticMarkup(<CatalogListingCardSkeleton {...{ compactMobile, showSeller }} stableLayout={false} />))
      expect(defaults.match(/animate-pulse/g)).toHaveLength(6)
      expect(defaults).toContain('class="pt-3 space-y-1.5"')
      expect(defaults).not.toContain("stableText")
    }
  }
  expect(productMarkup(3, true, false)).not.toContain("stableText")
})

it("shares the fixed text height between product/skeleton slots and compressed reservations", () => {
  const stableCss = readFileSync(path.join(root, "app/components/commerce/catalog-listing-stable-layout.module.css"), "utf8")
  const pendingCss = readFileSync(path.join(root, "app/shop/[siteSlug]/shop-pending-grid.module.css"), "utf8")
  const textHeight = stableCss.match(/\n\s*height: ([\d.]+rem);/)?.[1]
  expect(textHeight).toBe("11.5rem")
  expect(pendingCss).toContain(`* var(--shop-image-ratio) + ${textHeight})`)
})

browserTest("keeps real products, stable skeletons and compressed reservations identical through partial/full replacement", async () => {
  const css = await layoutCss()
  const browser = await chromium.launch({ headless: true, executablePath })
  const fetchMock = jest.mocked(global.fetch)
  fetchMock.mockClear()
  try {
    const page = await browser.newPage()
    const requests: string[] = []
    await page.route("**/*", (route) => { requests.push(route.request().url()); return route.abort() })
    for (const width of [375, 640, 767, 768, 1024, 1280]) {
      for (const compactMobile of [false, true]) {
        const products = Array.from({ length: totalCount }, (_, index) => productMarkup(index, compactMobile))
        const skeleton = renderToStaticMarkup(<CatalogListingCardSkeleton compactMobile={compactMobile} stableLayout />)
        const grid = commerceProductGridClassName(compactMobile)
        const container = `class="container ${compactMobile ? "compact" : ""}" style="width:calc(100% - 32px);margin:16px"`
        await page.setViewportSize({ width, height: 800 })
        await page.setContent(`<style>${css}</style>
          <div ${container}><div id="full" class="${grid}">${products.join("")}</div></div>
          <div ${container}><div id="skeletons" class="${grid}">${skeleton.repeat(totalCount)}</div></div>
          <div ${container}><div id="reserved" class="${grid}"></div><h2 id="next-category">Next category</h2></div>`)

        const productGeometry = await page.evaluate(() => {
          const full = document.getElementById("full")!
          const cards = Array.from(full.children)
          return {
            heights: cards.map((card) => card.getBoundingClientRect().height),
            textHeights: cards.map((card) => card.lastElementChild!.getBoundingClientRect().height),
            overflow: cards.some((card) => card.scrollWidth > card.clientWidth + 1),
            titleClamp: cards.every((card) => getComputedStyle(card.querySelector("h3")!).webkitLineClamp === "2"),
            descriptionsBounded: cards.every((card) => {
              const description = card.querySelector(".description")!
              const clamp = getComputedStyle(description).webkitLineClamp
              return description.getBoundingClientRect().height <= 32 &&
                (description.textContent ? clamp === "1" || clamp === "2" : true)
            }),
            variantsSingleRow: Array.from(full.querySelectorAll(".variants")).every((variants) => {
              const labels = Array.from(variants.children)
              const center = (label: Element) => {
                const rect = label.getBoundingClientRect()
                return rect.top + rect.height / 2
              }
              return labels.every((label) => Math.abs(center(label) - center(labels[0])) < 0.1)
            }),
            ctaVisible: cards.every((card) => {
              const button = card.querySelector("button")!
              const rect = button.getBoundingClientRect()
              const image = card.firstElementChild!.getBoundingClientRect()
              return Boolean(button.getAttribute("aria-label")) && rect.height >= 36 && rect.top >= image.top && rect.bottom <= image.bottom
            }),
            variantsAccessible: Boolean(full.querySelector('[role="group"][aria-label*="Fifth option"]')),
            buyersAccessible: Boolean(full.querySelector('[role="group"][aria-label*="Alice Taylor"]')),
            inventoryVisible: Array.from(full.querySelectorAll(".merch > div > span")).every((label) => label.getBoundingClientRect().height === 16),
          }
        })
        expect(productGeometry.textHeights.every((height) => height === 184)).toBe(true)
        expect(Math.max(...productGeometry.heights) - Math.min(...productGeometry.heights)).toBeLessThan(0.1)
        expect(productGeometry).toMatchObject({ overflow: false, titleClamp: true, descriptionsBounded: true, variantsSingleRow: true, ctaVisible: true, variantsAccessible: true, buyersAccessible: true, inventoryVisible: true })
        const fullHeight = await page.locator("#full").evaluate((element) => element.getBoundingClientRect().height)
        const skeletonHeight = await page.locator("#skeletons").evaluate((element) => element.getBoundingClientRect().height)
        expect(Math.abs(fullHeight - skeletonHeight)).toBeLessThan(0.1)

        let reservedTop: number | undefined
        for (const loadedCount of [0, 1, 2, 3, 4, 7, totalCount]) {
          const pendingCount = totalCount - loadedCount
          const pending = pendingCount ? renderToStaticMarkup(<ShopPendingGrid {...{ loadedCount, pendingCount, compactMobile }} />) : ""
          await page.locator("#reserved").evaluate((element, markup) => { element.innerHTML = markup }, products.slice(0, loadedCount).join("") + pending)
          const geometry = await page.evaluate(() => ({
            height: document.getElementById("reserved")!.getBoundingClientRect().height,
            nextTop: document.getElementById("next-category")!.getBoundingClientRect().top,
          }))
          reservedTop ??= geometry.nextTop
          expect({ width, compactMobile, loadedCount, matches: Math.abs(fullHeight - geometry.height) < 0.1 }).toEqual({ width, compactMobile, loadedCount, matches: true })
          expect(Math.abs(reservedTop - geometry.nextTop)).toBeLessThan(0.1)
        }
      }
    }
    expect(requests).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  } finally {
    await browser.close()
  }
}, 60_000)