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

  it("builds the requested glossy glass campaign style for maximum clarity", () => {
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
    expect(prompt).toContain("vivid red with medium-to-high saturation")
    expect(prompt).toContain("unmistakable dominant hue")
    expect(prompt).toContain("medium-to-high saturation")
    expect(prompt).toContain("smaller harmonious warm accent")
    expect(prompt).toContain(
      "Black, charcoal, gray, and white may appear only in small details",
    )
    expect(prompt).toContain("maintaining strong contrast")
    expect(prompt).toContain("do not use pink, orange, neutrals")
    expect(prompt).not.toContain("Choose a simple harmonious palette freely")
    expect(prompt).not.toContain("over any predetermined color family")
    expect(prompt).toContain("strong legibility at small UI sizes")
    expect(prompt).toContain("large and filling most of the canvas")
    expect(prompt).toContain("do not place it inside an app tile")
    expect(prompt).toContain("iOS-style squircle")
    expect(prompt).toContain("rounded-square container")
    expect(prompt).toContain(
      "clean, seamless background chosen to provide maximum contrast",
    )
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
    expect(prompt).toContain("Choose a simple harmonious palette freely")
    expect(prompt).toContain("one clearly chromatic dominant hue")
    expect(prompt).toContain("must never dominate the object")
    expect(prompt).not.toContain("violet")
  })

  it.each([
    ["marketing", "content", "play button", "triangular play symbol"],
    ["marketing", "contentCreator", "classic printer", "sheet of paper"],
    ["marketing", "assets", "image folder", "landscape image thumbnail"],
    ["sales", "salesHome", "house", "welcoming detached house"],
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
    ["finance", "financeReports", "stack of books", "three substantial hardcover accounting books"],
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
    "prioritizes visibility over a fixed color family for %s apps",
    (area) => {
      const prompt = getModuleImagePrompt(area, "unknown", "Example")
      expect(prompt).toContain("one clearly chromatic dominant hue")
      expect(prompt).toContain("one supporting secondary hue")
      expect(prompt).toContain("must never dominate the object")
      expect(prompt).toContain("Avoid busy multicolor treatment")
      expect(prompt).toContain("prioritize icon visibility and clarity")
      expect(prompt).toContain("background chosen to provide maximum contrast")
      expect(prompt).not.toMatch(
        /pastel|featuring (?:red|blue|teal|amber|violet|indigo|emerald|lime|magenta)/i,
      )
    },
  )

  it.each([
    ["sales", "pos"],
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
    ["settings", "settingsGeneral"],
  ] as const)("renders %s/%s as a full-size isolated object", (area, itemKey) => {
    expect(FULL_SIZE_MODULE_IMAGE_KEYS.has(itemKey)).toBe(true)

    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")
    expect(prompt).toContain(
      "Apple iOS Calendar, Notes, Contacts, and Reminders icons",
    )
    expect(prompt).toContain("visual polish, spacing discipline, and clarity")
    expect(prompt).toContain("rather than copying their symbols or outer app tiles")
    expect(prompt).toContain("full-size at 88 to 92 percent")
    expect(prompt).toContain("optically centered, evenly balanced")
    expect(prompt).toContain("narrow consistent safe margin")
    expect(prompt).not.toMatch(
      /transparent|alpha channel|checkerboard|backdrop|without (?:a )?background/i,
    )
    expect(prompt).not.toContain("background chosen to provide maximum contrast")
  })

  it.each([
    ["settings", "settingsGeneral"],
    ["automation", "channels"],
    ["operations", "printers"],
  ] as const)("removes the icon container from %s/%s", (area, itemKey) => {
    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")

    expect(prompt).toContain("Show only the standalone symbol itself")
    expect(prompt).toContain("remove any surrounding icon container")
    expect(prompt).toContain("outer tile")
    expect(prompt).toContain("background plate")
  })

  it.each([
    ["sales", "salesHome"],
    ["buying", "purchasesSubscriptions"],
    ["finance", "payments"],
    ["settings", "integrations"],
    ["settings", "company"],
    ["buying", "purchasesOrders"],
    ["automation", "context"],
    ["settings", "marketplace"],
  ] as const)("requests a fresh alternative for %s/%s", (area, itemKey) => {
    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")

    expect(prompt).toContain("Create a fresh alternative composition")
    expect(prompt).toContain("distinctly new arrangement and proportions")
    expect(prompt).toContain("same single recognizable subject")
  })

  it.each([
    ["settings", "billing"],
    ["buying", "purchasesOrders"],
  ] as const)("uses a bright high-contrast palette for %s/%s", (area, itemKey) => {
    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")

    expect(prompt).toContain("bright high-contrast palette")
    expect(prompt).toContain("luminous golden yellow and vivid warm orange")
    expect(prompt).toContain("Do not use blue and black together")
    expect(prompt).toContain("do not place dark blue elements on black")
    expect(prompt).toContain("dark tones for small functional details only")
    expect(prompt).not.toContain("Choose a simple harmonious palette freely")
  })

  it.each([
    ["sales", "salesHome"],
    ["settings", "marketplace"],
    ["settings", "company"],
    ["operations", "printers"],
    ["automation", "channels"],
    ["finance", "payments"],
    ["finance", "financeReports"],
  ] as const)("forces a second generation pass for %s/%s", (area, itemKey) => {
    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")

    expect(prompt).toContain("completely new second-pass render")
    expect(prompt).toContain("rather than reusing any previous result")
  })

  it.each([
    ["sales", "salesHome"],
    ["settings", "marketplace"],
    ["settings", "company"],
    ["operations", "printers"],
    ["automation", "channels"],
    ["finance", "payments"],
    ["finance", "financeReports"],
  ] as const)("keeps the second-pass prompt within the image API limit for %s/%s", (area, itemKey) => {
    const prompt = getModuleImagePrompt(area, itemKey, "Ignored Title")

    expect(prompt.length).toBeLessThanOrEqual(2_000)
  })

  it("uses clearly distinct new compositions for Home and Marketplace", () => {
    const homePrompt = getModuleImagePrompt("sales", "salesHome", "Home")
    const marketplacePrompt = getModuleImagePrompt(
      "settings",
      "marketplace",
      "Marketplace",
    )

    expect(homePrompt).toContain("centered front door")
    expect(homePrompt).toContain("no dashboard, chart, sales board")
    expect(marketplacePrompt).toContain("arched central doorway")
    expect(marketplacePrompt).toContain("striped awning offset to one side")
    expect(marketplacePrompt).toContain(
      "clearly different proportions from the previous symmetric storefront",
    )
  })

  it("does not request an alternative composition for unrelated modules", () => {
    expect(
      getModuleImagePrompt("marketing", "campaigns", "Campaigns"),
    ).not.toContain("Create a fresh alternative composition")
    expect(
      getModuleImagePrompt("sales", "subscriptions", "Subscriptions"),
    ).not.toContain("Create a fresh alternative composition")
    expect(
      getModuleImagePrompt("sales", "subscriptions", "Subscriptions"),
    ).not.toContain("completely new second-pass render")
  })

  it("keeps the standard composition for modules outside the full-size set", () => {
    const prompt = getModuleImagePrompt("marketing", "campaigns", "Campaigns")

    expect(FULL_SIZE_MODULE_IMAGE_KEYS.has("campaigns")).toBe(false)
    expect(prompt).toContain("large and filling most of the canvas")
    expect(prompt).toContain("background chosen to provide maximum contrast")
    expect(prompt).not.toContain("full-size at 88 to 92 percent")
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
