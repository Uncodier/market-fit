import {
  getModuleImagePrompt,
  getModuleImageUrl,
  MODULE_IMAGE_HINTS,
} from "@/app/config/module-image-visuals"
import {
  NAVIGATION_AREAS,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"

describe("module image visuals", () => {
  it("uses a short object hint for every app instead of the raw screen name", () => {
    for (const area of Object.keys(NAVIGATION_AREAS) as WorkspaceArea[]) {
      for (const item of NAVIGATION_AREAS[area].items) {
        const hint = MODULE_IMAGE_HINTS[item.key]
        expect(hint).toBeTruthy()
        expect(hint.split(" ").length).toBeLessThanOrEqual(3)

        const prompt = getModuleImagePrompt(area, item.key, "Ignored Title")
        expect(prompt).toContain(`object of a ${hint} app icon`)
        expect(prompt).not.toContain(`${item.key} icon`)
        expect(prompt).not.toMatch(/bullseye target|checkout terminal|discount ticket/)
      }
    }
  })

  it("avoids literal leads and quotations wording", () => {
    expect(getModuleImagePrompt("sales", "leads", "Leads")).toContain(
      "contact cards app icon",
    )
    expect(getModuleImagePrompt("sales", "leads", "Leads")).not.toContain(
      "leads icon",
    )
    expect(getModuleImagePrompt("sales", "quotations", "Quotations")).toContain(
      "quote paper app icon",
    )
    expect(getModuleImagePrompt("sales", "quotations", "Quotations")).not.toContain(
      "quotations icon",
    )
  })

  it("builds the requested campaign style with a smooth linear background", () => {
    const prompt = getModuleImagePrompt(
      "marketing",
      "campaigns",
      "Campaigns",
    )

    expect(prompt).toContain("Volumetric 3D isometric object of a target app icon")
    expect(prompt).toContain("completely textless")
    expect(prompt).toContain("featuring red as the dominant color")
    expect(prompt).toContain("uniform mint pastel background")
    expect(prompt).toContain("very subtle smooth linear gradient")
    expect(prompt).toContain("no blobs, no stains")
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

  it("uses a house icon for the AI Workspace", () => {
    const prompt = getModuleImagePrompt(
      "automation",
      "aiWorkspace",
      "AI Workspace",
    )

    expect(prompt).toContain("Volumetric 3D isometric object of a house app icon")
    expect(prompt).toContain("featuring violet as the dominant color")
  })

  it.each(Object.keys(NAVIGATION_AREAS) as WorkspaceArea[])(
    "uses a distinct color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toMatch(/featuring .+ as the dominant color/)
      expect(prompt).toMatch(/uniform .+ pastel background/)
      expect(prompt).toContain("very subtle smooth linear gradient")
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
