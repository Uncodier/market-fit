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
        expect(prompt).toContain(`icon of a ${hint} app icon`)
        expect(prompt).not.toContain(`${item.key} icon`)
        expect(prompt).not.toMatch(/bullseye target|checkout terminal|discount ticket/)
      }
    }
  })

  it("avoids literal leads wording and depicts quotations as price estimates", () => {
    expect(getModuleImagePrompt("sales", "leads", "Leads")).toContain(
      "contact cards app icon",
    )
    expect(getModuleImagePrompt("sales", "leads", "Leads")).not.toContain(
      "leads icon",
    )
    expect(getModuleImagePrompt("sales", "quotations", "Quotations")).toContain(
      "price estimate document app icon",
    )
    const quotationPrompt = getModuleImagePrompt(
      "sales",
      "quotations",
      "Quotations",
    )
    expect(quotationPrompt).toContain("commercial price estimate sheet")
    expect(quotationPrompt).toContain("not quotation marks")
    expect(quotationPrompt).toContain("a calendar, or an appointment")
  })

  it("builds the requested glossy glass campaign style with object contrast", () => {
    const prompt = getModuleImagePrompt(
      "marketing",
      "campaigns",
      "Campaigns",
    )

    expect(prompt).toContain("Front-facing 3D icon of a target app icon")
    expect(prompt).toContain("viewed straight on at eye level")
    expect(prompt).toContain("no isometric angle")
    expect(prompt).toContain("no tilted perspective")
    expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
    expect(prompt).toContain("Soft pastel color palette featuring red")
    expect(prompt).toContain("complementary pastel accent colors")
    expect(prompt).toContain("clear tonal separation")
    expect(prompt).toContain("avoid a flat monochrome look")
    expect(prompt).toContain("strong legibility at small UI sizes")
    expect(prompt).toContain("seamless mint pastel gradient background")
    expect(prompt).toContain("Octane render, 8k resolution")
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

    expect(prompt).toContain("Front-facing 3D icon of a house app icon")
    expect(prompt).toContain("featuring violet")
  })

  it.each([
    ["marketing", "assets", "image folder", "landscape image thumbnail"],
    ["sales", "quotations", "price estimate document", "currency symbol"],
    ["operations", "controlCenter", "checklist", null],
    ["operations", "visits", "visitor ID badge", "person silhouette"],
    ["operations", "checkIn", "QR scanner", "scanner corner brackets"],
    ["automation", "workflows", "three step arrows", "sequential steps"],
    ["finance", "financeReports", "bar chart", null],
    ["finance", "chartOfAccounts", "ledger book", null],
    ["finance", "payments", "hand holding coin", "currency symbol"],
  ] as const)(
    "uses a simple, recognizable symbol for %s/%s",
    (area, itemKey, hint, detail) => {
      expect(MODULE_IMAGE_HINTS[itemKey]).toBe(hint)
      const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")
      expect(prompt).toContain(
        `icon of a ${hint} app icon`,
      )
      if (detail) expect(prompt).toContain(detail)
    },
  )

  it.each(Object.keys(NAVIGATION_AREAS) as WorkspaceArea[])(
    "uses a distinct color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toMatch(/featuring .+/)
      expect(prompt).toMatch(/seamless .+ pastel gradient background/)
      expect(prompt).toContain("complementary pastel accent colors")
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
