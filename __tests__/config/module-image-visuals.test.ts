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

    expect(prompt).toContain("Volumetric 3D isometric object of a bullseye target")
    expect(prompt).toContain("completely textless")
    expect(prompt).toContain("featuring red as the dominant color")
    expect(prompt).toContain("mint pastel with subtle red gradients")
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

  it("uses a home subject for the AI Workspace icon", () => {
    const prompt = getModuleImagePrompt(
      "automation",
      "aiWorkspace",
      "AI Workspace",
    )

    expect(prompt).toContain("Volumetric 3D isometric object of a home")
    expect(prompt).toContain("featuring violet as the dominant color")
  })

  it.each(Object.keys(NAVIGATION_AREAS) as WorkspaceArea[])(
    "uses a distinct color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toMatch(/featuring .+ as the dominant color/)
      expect(prompt).toMatch(/uniform .+ pastel with subtle .+ gradients background/)
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
