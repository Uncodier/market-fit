import {
  FULL_SIZE_MODULE_IMAGE_KEYS,
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
        expect(prompt).toContain(`Front-facing 3D ${hint}`)
        expect(prompt).not.toContain("app icon")
        expect(prompt).not.toContain(`${item.key} icon`)
        expect(prompt).not.toMatch(/bullseye target|checkout terminal|discount ticket/)
      }
    }
  })

  it("depicts leads as an avatar and quotations as a paper stack", () => {
    expect(getModuleImagePrompt("sales", "leads", "Leads")).toContain(
      "Front-facing 3D user avatar",
    )
    expect(getModuleImagePrompt("sales", "leads", "Leads")).not.toContain(
      "leads icon",
    )
    expect(getModuleImagePrompt("sales", "quotations", "Quotations")).toContain(
      "Front-facing 3D stack of papers",
    )
    const quotationPrompt = getModuleImagePrompt(
      "sales",
      "quotations",
      "Quotations",
    )
    expect(quotationPrompt).toContain("exactly three overlapping paper sheets")
    expect(quotationPrompt).toContain("no currency symbol")
    expect(quotationPrompt).toContain("quotation marks")
  })

  it("builds the requested glossy glass campaign style with object contrast", () => {
    const prompt = getModuleImagePrompt(
      "marketing",
      "campaigns",
      "Campaigns",
    )

    expect(prompt).toContain("Front-facing 3D target")
    expect(prompt).toContain("viewed straight on at eye level")
    expect(prompt).toContain("no isometric angle")
    expect(prompt).toContain("no tilted perspective")
    expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
    expect(prompt).toContain("Soft pastel color palette featuring red")
    expect(prompt).toContain("complementary pastel accent colors")
    expect(prompt).toContain("clear tonal separation")
    expect(prompt).toContain("avoid a flat monochrome look")
    expect(prompt).toContain("strong legibility at small UI sizes")
    expect(prompt).toContain("large and filling most of the canvas")
    expect(prompt).toContain("do not place it inside an app tile")
    expect(prompt).toContain("iOS-style squircle")
    expect(prompt).toContain("rounded-square container")
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

    expect(prompt).toContain("Front-facing 3D house")
    expect(prompt).toContain("featuring violet")
  })

  it.each([
    ["marketing", "content", "play button", "triangular play symbol"],
    ["marketing", "contentCreator", "classic printer", "sheet of paper"],
    ["marketing", "assets", "image folder", "landscape image thumbnail"],
    ["sales", "catalog", "product shelf", "several clearly separated products"],
    ["sales", "subscriptions", "ID card", "person silhouette"],
    ["sales", "leads", "user avatar", "round head and rounded shoulders"],
    ["sales", "quotations", "stack of papers", "visible offset edges"],
    ["sales", "people", "magnifying glass", "no person, document"],
    ["operations", "chat", "chat bubble", "tail integrated into the lower-left edge"],
    ["operations", "records", "spreadsheet sheet", "grid of rows and columns"],
    ["operations", "orderLines", "digital numbers", "seven-segment digital digits"],
    ["operations", "controlCenter", "checklist", null],
    ["operations", "visits", "visitor ID badge", "person silhouette"],
    ["operations", "checkIn", "signature", "handwritten signature stroke"],
    ["operations", "printers", "thermal printer", "visible receipt"],
    ["automation", "workflows", "lightning bolt", "strong luminance and color contrast"],
    ["automation", "channels", "classic telephone", "curved handset"],
    ["automation", "activities", "AI sparkle", "four-point AI sparkle star"],
    ["finance", "chartOfAccounts", "ledger book", null],
    ["finance", "payments", "wallet", "visible bill compartment"],
    ["reports", "reportPerformance", "speedometer gauge", "bold needle"],
    ["reports", "reportSocial", "heart", "no chart, graph, counter"],
    ["settings", "team", "large avatar group", "filling most of the canvas"],
    ["settings", "integrations", "plug", "two metal prongs"],
    ["settings", "social", "heart", "simple solid heart silhouette"],
    ["settings", "security", "shield", "simple solid shield silhouette"],
  ] as const)(
    "uses a simple, recognizable symbol for %s/%s",
    (area, itemKey, hint, detail) => {
      expect(MODULE_IMAGE_HINTS[itemKey]).toBe(hint)
      const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")
      expect(prompt).toContain(
        `Front-facing 3D ${hint}`,
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

  it.each([
    ["sales", "catalog"],
    ["operations", "records"],
    ["operations", "shipments"],
    ["operations", "reservations"],
    ["operations", "inventory"],
    ["operations", "printers"],
    ["automation", "channels"],
    ["finance", "payments"],
    ["reports", "reportTraffic"],
    ["settings", "company"],
    ["settings", "marketplace"],
    ["settings", "calendar"],
  ] as const)("renders %s/%s as a full-size isolated object", (area, itemKey) => {
    expect(FULL_SIZE_MODULE_IMAGE_KEYS.has(itemKey)).toBe(true)

    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")
    expect(prompt).toContain("full-size cutout occupying 88 to 92 percent")
    expect(prompt).toContain("no visible backdrop treatment")
    expect(prompt).toContain("fully transparent canvas with a real alpha channel")
    expect(prompt).toContain("standalone polished iOS 3D glyph")
    expect(prompt).toContain("no solid color, gradient, white fill")
    expect(prompt).not.toContain("seamless mint pastel gradient background")
  })

  it("keeps the standard composition for modules outside the full-size set", () => {
    const prompt = getModuleImagePrompt("marketing", "campaigns", "Campaigns")

    expect(FULL_SIZE_MODULE_IMAGE_KEYS.has("campaigns")).toBe(false)
    expect(prompt).toContain("large and filling most of the canvas")
    expect(prompt).toContain("seamless mint pastel gradient background")
    expect(prompt).not.toContain("full-size cutout occupying 88 to 92 percent")
  })

  it("keeps Point of Sale unchanged with the standard composition", () => {
    const prompt = getModuleImagePrompt("sales", "pos", "Point of Sale")

    expect(FULL_SIZE_MODULE_IMAGE_KEYS.has("pos")).toBe(false)
    expect(prompt).toContain("Front-facing 3D cash register")
    expect(prompt).toContain("large and filling most of the canvas")
    expect(prompt).toContain("seamless peach pastel gradient background")
    expect(prompt).not.toContain("fully transparent canvas")
  })

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
