/** @jest-environment node */

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
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
  it("overrides exactly the requested 19 modules", () => {
    expect(Object.keys(MAKINARI_MODULE_IMAGE_OVERRIDES).sort()).toEqual(
      selectedIcons.map(([key]) => key).sort(),
    )
    expect(readdirSync(path.join(process.cwd(), "public", assetPath)).sort()).toEqual(
      selectedIcons.map(([, name]) => `${name}.webp`).sort(),
    )
  })

  it.each(selectedIcons)("serves %s as the same static asset in every workspace", (key, name) => {
    const expected = `${assetPath}/${name}.webp`
    expect(MAKINARI_MODULE_IMAGE_OVERRIDES[key]).toBe(expected)
    expect(getModuleImageUrl("marketing", key, "First workspace")).toBe(expected)
    expect(getModuleImageUrl("settings", key, "Another workspace")).toBe(expected)
    expect(expected).not.toContain("/api/")
    expect(expected).not.toContain("site_id")
  })

  it.each(selectedIcons)("ships a real optimized raster image for %s", async (key, name) => {
    const bytes = readFileSync(path.join(process.cwd(), "public", assetPath, `${name}.webp`))
    const metadata = await sharp(bytes).metadata()
    expect(metadata).toMatchObject({ format: "webp", width: 512, height: 512 })
    expect(bytes.length).toBeGreaterThan(1_000)
    expect(bytes.length).toBeLessThan(100_000)
  })
})