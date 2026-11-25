/** @jest-environment node */

import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { MODULE_ICON_FILES } from "@/app/config/module-icon-files"
import { getModuleImageUrl, MODULE_IMAGE_HINTS } from "@/app/config/module-image-visuals"
import { catalogIconUrl } from "@/__tests__/fixtures/module-icon-url"
import nextConfig from "../../next.config"

const catalogPath = "/images/modules/catalog"
const directory = path.join(process.cwd(), "public", catalogPath)

describe("module icon catalog", () => {
  it("maps every recognized key and ships exactly the referenced files", () => {
    expect(Object.keys(MODULE_ICON_FILES).sort()).toEqual(Object.keys(MODULE_IMAGE_HINTS).sort())
    expect(readdirSync(directory).sort()).toEqual([...new Set(Object.values(MODULE_ICON_FILES))].sort())
  })

  it.each(Object.entries(MODULE_ICON_FILES))("serves %s as its content-addressed WebP", async (key, filename) => {
    const url = getModuleImageUrl("settings", key, "Ignored label")
    const assetKey = key === "aiWorkspace" ? "salesHome" : key
    expect(url).toEqual(catalogIconUrl(assetKey))
    expect(url).toBe(`${catalogPath}/${filename}`)

    const bytes = readFileSync(path.join(process.cwd(), "public", url))
    const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
    expect(filename).toBe(`${assetKey}.${digest}.webp`)
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 })
  })

  it("sets a one-year public immutable cache policy on the catalog route", async () => {
    const headers = await nextConfig.headers?.()
    const catalog = headers?.find(rule => rule.source === `${catalogPath}/:file*`)
    const cache = catalog?.headers.find(header => header.key.toLowerCase() === "cache-control")
    expect(cache?.value.toLowerCase().split(",").map(token => token.trim()).sort())
      .toEqual(["immutable", "max-age=31536000", "public"])
  })
})