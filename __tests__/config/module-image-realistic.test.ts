import { getModuleImagePrompt } from "@/app/config/module-image-visuals"
import { getRealisticModuleImagePrompt } from "@/app/config/module-image-realistic"

describe("selected realistic navigation refresh", () => {
  it.each([
    ["procurementSettings", "golden orange", "pastel lavender"],
    ["appsLauncher", "cobalt blue", "pastel peach"],
    ["procurementApprovals", "emerald green", "pastel rose"],
    ["procurementRules", "royal purple", "pastel butter-yellow"],
    ["procurementTenders", "warm red", "pastel mint"],
  ])("combines realistic rendering with UI clarity for %s", (key, color, background) => {
    const prompt = getModuleImagePrompt("buying", key, "Ignored title")
    expect(prompt).toContain("Volumetric 3D isometric")
    expect(prompt).toContain("Show one")
    expect(prompt).toContain("completely textless")
    expect(prompt).toContain("physically based materials (PBR)")
    expect(prompt).toContain("ZERO contact shadows")
    expect(prompt).toContain("no cast shadow on the background")
    expect(prompt).toContain("88 to 92 percent")
    expect(prompt).toContain("strong legibility at small UI sizes")
    expect(prompt).toContain(color)
    expect(prompt).toContain(background)
    expect(prompt).toContain("Unreal Engine 5")
    expect(prompt).not.toContain("Front-facing")
    expect(prompt).not.toContain("no isometric angle")
    expect(getModuleImagePrompt("settings", key, "Translated title")).toBe(prompt)
  })

  it.each(["settingsGeneral", "purchasesOrders", "purchaseRequests", "suppliers", "campaigns"])(
    "preserves unrelated prompts for %s", (key) => {
      expect(getRealisticModuleImagePrompt(key, "object")).toBeUndefined()
      expect(getModuleImagePrompt("buying", key, "")).toContain("Front-facing 3D")
    },
  )
})