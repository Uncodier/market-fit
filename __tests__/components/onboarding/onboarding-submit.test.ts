import { siteOnboardingSchema } from "@/app/components/onboarding/schemas/onboarding-schema"
import {
  getFirstErrorStep,
  getValidationErrorMessage,
  sanitizeOnboardingValues,
} from "@/app/components/onboarding/utils/onboarding-submit"

function baseValues() {
  return {
    name: "  Acme  ",
    url: "  https://acme.com  ",
    description: "",
    logo_url: "",
    focusMode: 50,
    business_hours: [],
    locations: [],
    about: "",
    company_size: "",
    industry: "",
    swot: {
      strengths: "",
      weaknesses: "",
      opportunities: "",
      threats: "",
    },
    goals: {
      quarterly: "",
      yearly: "",
      fiveYear: "",
      tenYear: "",
    },
    marketing_budget: {
      total: 0,
      available: 0,
    },
    marketing_channels: [],
    products: [],
    services: [],
  }
}

describe("onboarding submit helpers", () => {
  it("drops empty optional products and still passes schema validation", () => {
    const sanitized = sanitizeOnboardingValues({
      ...baseValues(),
      products: [
        { name: "", description: "ignored", cost: 0 },
        { name: "Widget", description: "kept", cost: 10 },
      ],
      services: [{ name: "   " }],
    })

    expect(sanitized.products).toEqual([
      { name: "Widget", description: "kept", cost: 10 },
    ])
    expect(sanitized.services).toEqual([])
    expect(sanitized.name).toBe("Acme")
    expect(sanitized.url).toBe("https://acme.com")
    expect(siteOnboardingSchema.safeParse(sanitized).success).toBe(true)
  })

  it("maps a name validation error back to step 1", () => {
    const parsed = siteOnboardingSchema.safeParse({
      ...baseValues(),
      name: "A",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(getFirstErrorStep(parsed.error)).toBe(1)
    expect(getValidationErrorMessage(parsed.error)).toContain("Project name")
  })
})
