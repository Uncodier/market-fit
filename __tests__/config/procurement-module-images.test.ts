import {
  getModuleImagePrompt,
  getModuleImageUrl,
  MODULE_IMAGE_HINTS,
} from "@/app/config/module-image-visuals"
import type { WorkspaceArea } from "@/app/config/navigation-areas"

const PROCUREMENT_MODULES: [WorkspaceArea, string, string][] = [
  ["buying", "suppliers", "supplier building"],
  ["buying", "purchaseRequests", "request clipboard"],
  ["buying", "procurementApprovals", "approval stamp"],
  ["buying", "procurementTenders", "sealed envelope"],
  ["buying", "procurementRules", "rule book"],
  ["settings", "procurementSettings", "procurement gear"],
]

describe("procurement module images", () => {
  it.each(PROCUREMENT_MODULES)(
    "uses a stable 3D object for %s/%s",
    (area, itemKey, subject) => {
      const prompt = getModuleImagePrompt(area, itemKey, "Original title")

      expect(MODULE_IMAGE_HINTS[itemKey]).toBe(subject)
      expect(prompt).toContain(`Front-facing 3D ${subject}`)
      expect(prompt).toContain("Show one")
      expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
      expect(prompt).toContain("strong legibility at small UI sizes")
      expect(prompt).toMatch(/; no .*objects/)
      expect(prompt).not.toContain("Original title")
      expect(getModuleImagePrompt(area, itemKey, "Translated title")).toBe(prompt)
      expect(getModuleImagePrompt(area, itemKey, "")).toBe(prompt)

      const url = new URL(getModuleImageUrl(area, itemKey, "Original title"))
      expect(decodeURIComponent(url.pathname)).toBe(`/api/public/image/prompt/${prompt}`)
      expect(url.searchParams.get("width")).toBe("256")
      expect(url.searchParams.get("height")).toBe("256")
      expect(url.searchParams.has("site_id")).toBe(false)
      expect(getModuleImageUrl(area, itemKey, "Translated title")).toBe(url.href)
    },
  )

  it("keeps each procurement module image distinct", () => {
    const urls = PROCUREMENT_MODULES.map(([area, itemKey]) =>
      getModuleImageUrl(area, itemKey, "Ignored title"),
    )

    expect(new Set(urls).size).toBe(PROCUREMENT_MODULES.length)
  })
})