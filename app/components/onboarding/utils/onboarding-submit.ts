import type { ZodError } from "zod"
import type { SiteOnboardingValues } from "../schemas/onboarding-schema"

const FIELD_TO_STEP: Record<string, number> = {
  name: 1,
  url: 1,
  description: 1,
  logo_url: 1,
  focusMode: 2,
  business_hours: 3,
  locations: 4,
  about: 5,
  company_size: 5,
  industry: 5,
  swot: 5,
  goals: 5,
  marketing_budget: 6,
  marketing_channels: 6,
  products: 7,
  services: 7,
}

function hasName<T extends { name?: string }>(item: T): boolean {
  return Boolean(item.name && item.name.trim())
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function sanitizeOnboardingValues(
  values: SiteOnboardingValues
): SiteOnboardingValues {
  return {
    ...values,
    name: values.name?.trim() || "",
    url: values.url?.trim() || "",
    products: (values.products || []).filter(hasName),
    services: (values.services || []).filter(hasName),
    marketing_channels: (values.marketing_channels || []).filter(hasName),
    business_hours: (values.business_hours || []).filter(hasName),
    locations: (values.locations || [])
      .filter(hasName)
      .map((location) => ({
        ...location,
        restrictions: location.restrictions
          ? {
              ...location.restrictions,
              included_addresses: (location.restrictions.included_addresses || []).filter(hasName),
              excluded_addresses: (location.restrictions.excluded_addresses || []).filter(hasName),
            }
          : location.restrictions,
      })),
    marketing_budget: {
      total: finiteNumber(values.marketing_budget?.total),
      available: finiteNumber(values.marketing_budget?.available),
    },
  }
}

export function getFirstErrorStep(error: ZodError): number {
  let firstStep = 1
  let found = false

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "")
    const step = FIELD_TO_STEP[field]
    if (!step) continue
    if (!found || step < firstStep) {
      firstStep = step
      found = true
    }
  }

  return firstStep
}

export function getValidationErrorMessage(error: ZodError): string {
  const first = error.issues[0]
  if (first?.message) {
    return first.message
  }
  return "Please complete the required fields to create your project"
}
