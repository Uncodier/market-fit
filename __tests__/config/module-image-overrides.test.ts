/** @jest-environment node */

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { catalogIconUrl } from "@/__tests__/fixtures/module-icon-url"
import { MAKINARI_MODULE_IMAGE_OVERRIDES } from "@/app/config/module-image-overrides"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"

const selectedIcons = [
  ["campaigns", "campaigns"],
  ["segments", "segments"],
  ["priceLists", "price-lists"],
  ["leads", "leads"],
  ["pos", "point-of-sale"],
  ["chat", "conversations"],
  ["orderLines", "order-lines"],
  ["controlCenter", "tasks"],
  ["checkIn", "check-in"],
  ["inventory", "inventory"],
  ["assets", "assets"],
  ["requirements", "ai-goals"],
  ["activities", "ai-activities"],
  ["workflows", "workflows"],
  ["reportPerformance", "performance"],
  ["reportCosts", "cost-reports"],
  ["applicationsDatabase", "database"],
  ["applicationsRepositories", "code"],
  ["billing", "billing"],
] as const

const assetPath = "/images/modules/makinari-2026-09-30"

describe("selected Makinari module icons", () => {
  it("preserves the original 19 module overrides alongside the Connectors render", () => {
    expect(Object.keys(MAKINARI_MODULE_IMAGE_OVERRIDES).sort()).toEqual(
      [...selectedIcons.map(([key]) => key), "connectors"].sort(),
    )
    expect(readdirSync(path.join(process.cwd(), "public", assetPath)).sort()).toEqual(
      selectedIcons.map(([, name]) => `${name}.webp`).sort(),
    )
  })

  it("ships the generated Connectors icon as an optimized shared WebP", async () => {
    const url = "/images/modules/connectors.webp"
    expect(MAKINARI_MODULE_IMAGE_OVERRIDES.connectors).toBe(url)
    expect(getModuleImageUrl("automation", "connectors", "Connectors")).toEqual(catalogIconUrl("connectors"))
    const bytes = readFileSync(path.join(process.cwd(), "public", url))
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 512, height: 512 })
    expect(bytes.length).toBeLessThan(100_000)
  })

  it.each(selectedIcons)("serves %s as the same static asset in every workspace", (key, name) => {
    const expected = `${assetPath}/${name}.webp`
    expect(MAKINARI_MODULE_IMAGE_OVERRIDES[key]).toBe(expected)
    const url = getModuleImageUrl("marketing", key, "First workspace")
    expect(url).toEqual(catalogIconUrl(key))
    expect(getModuleImageUrl("settings", key, "Another workspace")).toBe(url)
  })

  it.each(selectedIcons)("ships a real optimized raster image for %s", async (key, name) => {
    const bytes = readFileSync(path.join(process.cwd(), "public", assetPath, `${name}.webp`))
    const metadata = await sharp(bytes).metadata()
    expect(metadata).toMatchObject({ format: "webp", width: 512, height: 512 })
    expect(bytes.length).toBeGreaterThan(1_000)
    expect(bytes.length).toBeLessThan(100_000)
  })
})