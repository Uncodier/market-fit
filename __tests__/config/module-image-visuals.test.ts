import {
  getModuleImagePrompt,
  getModuleImageUrl,
  MODULE_IMAGE_SUBJECTS,
} from "@/app/config/module-image-visuals"
import {
  NAVIGATION_AREAS,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"

describe("module image visuals", () => {
  it("defines a specific image subject for every app", () => {
    for (const area of Object.values(NAVIGATION_AREAS)) {
      for (const item of area.items) {
        expect(MODULE_IMAGE_SUBJECTS[item.key]).toBeTruthy()
      }
    }
  })

  it("builds the requested campaign style with the marketing color", () => {
    const prompt = getModuleImagePrompt(
      "marketing",
      "campaigns",
      "Campaigns",
    )

    expect(prompt).toContain("3D isometric icon")
    expect(prompt).toContain("bullseye target")
    expect(prompt).toContain("coral red and rose")
    expect(prompt).toContain("glossy plastic and frosted glass")
    expect(prompt).toContain("Octane render, 8k")
  })

  it("keeps the same prompt for a known app across UI contexts", () => {
    expect(
      getModuleImagePrompt("marketing", "campaigns", "Campaigns"),
    ).toBe(
      getModuleImagePrompt("marketing", "campaigns", "Create a campaign"),
    )
  })

  it.each(Object.keys(NAVIGATION_AREAS) as WorkspaceArea[])(
    "uses a distinct color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toMatch(/soft pastel .+ palette/)
    },
  )

  it("requests square 256px images from the public prompt endpoint", () => {
    const previousApiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL
    process.env.NEXT_PUBLIC_API_SERVER_URL = "https://images.example.com"

    const url = new URL(
      getModuleImageUrl("marketing", "campaigns", "Campaigns"),
    )

    expect(url.origin).toBe("https://images.example.com")
    expect(url.pathname).toContain("/api/public/image/prompt/")
    expect(url.searchParams.get("width")).toBe("256")
    expect(url.searchParams.get("height")).toBe("256")

    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_SERVER_URL
    } else {
      process.env.NEXT_PUBLIC_API_SERVER_URL = previousApiUrl
    }
  })
})
