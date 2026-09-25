import {
  getModuleImagePrompt,
  getModuleImageUrl,
} from "@/app/config/module-image-visuals"
import {
  NAVIGATION_AREAS,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"

describe("module image visuals", () => {
  it("names every app as its screen icon instead of a described object", () => {
    for (const area of Object.keys(NAVIGATION_AREAS) as WorkspaceArea[]) {
      for (const item of NAVIGATION_AREAS[area].items) {
        const prompt = getModuleImagePrompt(area, item.key, "Ignored Title")
        const expected = item.key
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .toLowerCase()
        expect(prompt).toContain(`object of a ${expected} icon`)
        expect(prompt).not.toMatch(/bullseye|checkout terminal|discount ticket/)
        expect(prompt).not.toMatch(/gradient/i)
      }
    }
  })

  it("builds the requested campaign style with the marketing color", () => {
    const prompt = getModuleImagePrompt(
      "marketing",
      "campaigns",
      "Campaigns",
    )

    expect(prompt).toContain("Volumetric 3D isometric object of a campaigns icon")
    expect(prompt).toContain("completely textless")
    expect(prompt).toContain("featuring red as the dominant color")
    expect(prompt).toContain("uniform mint pastel background")
    expect(prompt).toContain("ZERO contact shadows")
    expect(prompt).toContain("Unreal Engine 5 render, 8k")
  })

  it("keeps the same prompt for a known app across UI contexts", () => {
    expect(
      getModuleImagePrompt("marketing", "campaigns", "Campaigns"),
    ).toBe(
      getModuleImagePrompt("marketing", "campaigns", "Create a campaign"),
    )
  })

  it("uses a home icon for the AI Workspace", () => {
    const prompt = getModuleImagePrompt(
      "automation",
      "aiWorkspace",
      "AI Workspace",
    )

    expect(prompt).toContain("Volumetric 3D isometric object of a home icon")
    expect(prompt).toContain("featuring violet as the dominant color")
  })

  it.each(Object.keys(NAVIGATION_AREAS) as WorkspaceArea[])(
    "uses a distinct color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toMatch(/featuring .+ as the dominant color/)
      expect(prompt).toMatch(/uniform .+ pastel background/)
      expect(prompt).not.toMatch(/gradient/i)
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
