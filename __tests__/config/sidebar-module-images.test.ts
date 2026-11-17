import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { SHARED_MODULE_IMAGE_AREAS } from "@/app/config/shared-module-images"

it.each(["appsLauncher", "notifications"] as const)("uses the fixed shared AI prompt for %s", (key) => {
  const area = SHARED_MODULE_IMAGE_AREAS[key]
  const prompt = getModuleImagePrompt(area, key, "Ignored title")
  expect(getModuleImageUrl(area, key, "Ignored title")).toBe(`/api/images/modules/${key}`)
  expect(prompt).toBe(getModuleImagePrompt(area, key, "Translated title"))
  expect(prompt).toContain(key === "appsLauncher" ? "Volumetric 3D isometric" : "Front-facing 3D")
  expect(prompt).toContain(key === "appsLauncher" ? "physically based materials (PBR)" : "smooth glossy plastic and frosted glass texture")
  expect(prompt).toContain(key === "appsLauncher" ? "two-by-two grid" : "large clapper")
  expect(prompt).toContain("strong legibility at small UI sizes")
})