import { siteOnboardingSchema } from "@/app/components/onboarding/schemas/onboarding-schema"
import { isUsableSiteUrl, normalizeSiteUrl } from "@/app/components/onboarding/schemas/onboarding-schema"
import {
  getCreateSiteErrorMessage,
  getFirstErrorStep,
  getRequiredFieldErrors,
  getValidationErrorMessage,
  prepareOnboardingSubmit,
  sanitizeOnboardingValues,
  readAutofilledBasicFields,
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
  it("normalizes real-world URLs that zod url() would reject", () => {
    expect(normalizeSiteUrl("example.com")).toBe("https://example.com")
    expect(normalizeSiteUrl(" www.shop.mx ")).toBe("https://www.shop.mx")
    expect(isUsableSiteUrl("https://myshop")).toBe(true)
    expect(isUsableSiteUrl("https://localhost:3000")).toBe(true)
    expect(isUsableSiteUrl("https://")).toBe(false)
    expect(isUsableSiteUrl("")).toBe(false)
  })

  it("creates a project from messy optional data without failing schema", () => {
    const prepared = prepareOnboardingSubmit({
      ...baseValues(),
      url: "acme.com",
      products: [
        { name: "", description: "ignored", cost: Number.NaN as unknown as number },
        { name: "Widget", description: "kept", cost: -12 as unknown as number },
      ],
      services: [{ name: "   " }],
      marketing_channels: [{ name: "" }, { name: "Email" }],
      marketing_budget: { total: Number.NaN, available: -50 },
      locations: [
        { name: "", address: "skip" },
        {
          name: "HQ",
          restrictions: {
            enabled: true,
            included_addresses: [{ name: "" }, { name: "Mexico" }],
            excluded_addresses: [],
          },
        },
      ],
      business_hours: [
        {
          name: "",
          timezone: "America/Mexico_City",
          days: {
            monday: { enabled: true, start: "18:00", end: "09:00" },
            tuesday: { enabled: true, start: "09:00", end: "18:00" },
            wednesday: { enabled: true, start: "09:00", end: "18:00" },
            thursday: { enabled: true, start: "09:00", end: "18:00" },
            friday: { enabled: true, start: "09:00", end: "18:00" },
            saturday: { enabled: false, start: "09:00", end: "14:00" },
            sunday: { enabled: false, start: "09:00", end: "14:00" },
          },
        },
        {
          name: "Office",
          timezone: "",
          days: {
            monday: { enabled: true, start: "18:00", end: "09:00" },
            tuesday: { enabled: true, start: "09:00", end: "18:00" },
            wednesday: { enabled: true, start: "09:00", end: "18:00" },
            thursday: { enabled: true, start: "09:00", end: "18:00" },
            friday: { enabled: true, start: "09:00", end: "18:00" },
            saturday: { enabled: false, start: "09:00", end: "14:00" },
            sunday: { enabled: false, start: "09:00", end: "14:00" },
          },
        },
      ],
    } as any)

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(prepared.data.url).toBe("https://acme.com")
    expect(prepared.data.products).toEqual([
      expect.objectContaining({ name: "Widget", cost: 0 }),
    ])
    expect(prepared.data.services).toEqual([])
    expect(prepared.data.marketing_channels).toEqual([{ name: "Email" }])
    expect(prepared.data.marketing_budget).toEqual({ total: 0, available: 0 })
    expect(prepared.data.locations).toHaveLength(1)
    expect(prepared.data.locations[0].restrictions?.included_addresses).toEqual([
      expect.objectContaining({ name: "Mexico" }),
    ])
    expect(prepared.data.business_hours).toHaveLength(1)
    expect(prepared.data.business_hours[0].timezone).toBe("America/Mexico_City")
    expect(prepared.data.business_hours[0].days.monday.enabled).toBe(false)
    expect(siteOnboardingSchema.safeParse(prepared.data).success).toBe(true)
  })

  it("only blocks on missing name or invalid URL", () => {
    expect(getRequiredFieldErrors({ ...baseValues(), name: "" }).name).toBe(
      "Project name is required"
    )
    expect(getRequiredFieldErrors({ ...baseValues(), name: "A" }).name).toContain(
      "at least 2"
    )
    expect(getRequiredFieldErrors({ ...baseValues(), url: "https://" }).url).toBe(
      "Must be a valid URL"
    )

    const prepared = prepareOnboardingSubmit({ ...baseValues(), name: "A" })
    expect(prepared.ok).toBe(false)
    if (prepared.ok) return
    expect(getFirstErrorStep(prepared.error)).toBe(1)
    expect(getValidationErrorMessage(prepared.error)).toContain("Project name")
  })

  it("maps auth and payload failures to actionable messages", () => {
    expect(getCreateSiteErrorMessage(new Error("User not authenticated"))).toBe(
      "You need to sign in to create a project"
    )
    expect(
      getCreateSiteErrorMessage({ code: "42501", message: "new row violates row-level security" })
    ).toBe("You do not have permission to create a project")
    expect(
      getCreateSiteErrorMessage({ message: "Payload too large" })
    ).toBe("The logo is too large. Try a smaller image or skip it for now.")
  })

  it("reads Chrome autofilled name and url from native inputs", () => {
    const formEl = {
      querySelector: (selector: string) => {
        if (selector.includes('name="name"')) return { value: "Acme from Chrome" }
        if (selector.includes('name="url"')) return { value: "acme.com" }
        return null
      },
    } as Pick<HTMLFormElement, "querySelector">

    expect(readAutofilledBasicFields(formEl, { name: "", url: "" })).toEqual({
      name: "Acme from Chrome",
      url: "acme.com",
    })
    expect(readAutofilledBasicFields(formEl, {
      name: "Acme from Chrome",
      url: "acme.com",
    })).toEqual({})
    expect(readAutofilledBasicFields(null, { name: "", url: "" })).toEqual({})
  })

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
      expect.objectContaining({ name: "Widget", description: "kept", cost: 10 }),
    ])
    expect(sanitized.services).toEqual([])
    expect(sanitized.name).toBe("Acme")
    expect(sanitized.url).toBe("https://acme.com")
    expect(siteOnboardingSchema.safeParse(sanitized).success).toBe(true)
  })
})
