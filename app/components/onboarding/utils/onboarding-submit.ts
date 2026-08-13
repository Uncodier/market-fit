import type { ZodError } from "zod"
import {
  isUsableSiteUrl,
  normalizeSiteUrl,
  siteOnboardingSchema,
  type SiteOnboardingValues,
} from "../schemas/onboarding-schema"

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

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const DEFAULT_DAYS: SiteOnboardingValues["business_hours"][number]["days"] = {
  monday: { enabled: true, start: "09:00", end: "18:00" },
  tuesday: { enabled: true, start: "09:00", end: "18:00" },
  wednesday: { enabled: true, start: "09:00", end: "18:00" },
  thursday: { enabled: true, start: "09:00", end: "18:00" },
  friday: { enabled: true, start: "09:00", end: "18:00" },
  saturday: { enabled: false, start: "09:00", end: "14:00" },
  sunday: { enabled: false, start: "09:00", end: "14:00" },
}

function hasName<T extends { name?: string }>(item: T): boolean {
  return Boolean(item.name && item.name.trim())
}

export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback))
}

function clampFocusMode(value: unknown): number {
  return Math.min(100, Math.max(0, finiteNumber(value, 50)))
}

function sanitizeDay(
  day: { enabled?: boolean; start?: string; end?: string } | undefined,
  fallback: { enabled: boolean; start: string; end: string }
) {
  const start = day?.start || fallback.start
  const end = day?.end || fallback.end
  const enabled = Boolean(day?.enabled)
  if (enabled && start >= end) {
    return { enabled: false, start, end }
  }
  return { enabled, start, end }
}

function sanitizeOffer<T extends {
  name?: string
  description?: string
  cost?: unknown
  lowest_sale_price?: unknown
  target_sale_price?: unknown
}>(item: T) {
  return {
    ...item,
    name: item.name?.trim() || "",
    description: item.description || "",
    cost: nonNegativeNumber(item.cost),
    lowest_sale_price: nonNegativeNumber(item.lowest_sale_price),
    target_sale_price: nonNegativeNumber(item.target_sale_price),
  }
}

export function sanitizeOnboardingValues(
  values: SiteOnboardingValues
): SiteOnboardingValues {
  return {
    ...values,
    name: values.name?.trim() || "",
    url: normalizeSiteUrl(values.url || ""),
    description: values.description || "",
    logo_url: values.logo_url || "",
    focusMode: clampFocusMode(values.focusMode),
    products: (values.products || []).filter(hasName).map(sanitizeOffer),
    services: (values.services || []).filter(hasName).map(sanitizeOffer),
    marketing_channels: (values.marketing_channels || []).filter(hasName).map((channel) => ({
      ...channel,
      name: channel.name.trim(),
    })),
    business_hours: (values.business_hours || []).filter(hasName).map((hours) => ({
      ...hours,
      name: hours.name.trim(),
      timezone: hours.timezone || "America/Mexico_City",
      respectHolidays: hours.respectHolidays !== false,
      days: Object.fromEntries(
        DAY_KEYS.map((day) => [
          day,
          sanitizeDay(hours.days?.[day], DEFAULT_DAYS[day]),
        ])
      ) as SiteOnboardingValues["business_hours"][number]["days"],
    })),
    locations: (values.locations || [])
      .filter(hasName)
      .map((location) => ({
        ...location,
        name: location.name.trim(),
        restrictions: {
          enabled: Boolean(location.restrictions?.enabled),
          included_addresses: (location.restrictions?.included_addresses || []).filter(hasName),
          excluded_addresses: (location.restrictions?.excluded_addresses || []).filter(hasName),
        },
      })),
    marketing_budget: {
      total: nonNegativeNumber(values.marketing_budget?.total),
      available: nonNegativeNumber(values.marketing_budget?.available),
    },
    swot: {
      strengths: values.swot?.strengths || "",
      weaknesses: values.swot?.weaknesses || "",
      opportunities: values.swot?.opportunities || "",
      threats: values.swot?.threats || "",
    },
    goals: {
      quarterly: values.goals?.quarterly || "",
      yearly: values.goals?.yearly || "",
      fiveYear: values.goals?.fiveYear || "",
      tenYear: values.goals?.tenYear || "",
    },
  }
}

export function getRequiredFieldErrors(values: SiteOnboardingValues): {
  name?: string
  url?: string
} {
  const errors: { name?: string; url?: string } = {}
  const name = values.name?.trim() || ""
  const url = values.url?.trim() || ""

  if (!name) errors.name = "Project name is required"
  else if (name.length < 2) errors.name = "Project name must be at least 2 characters"

  if (!url) errors.url = "Site URL is required"
  else if (!isUsableSiteUrl(url)) errors.url = "Must be a valid URL"

  return errors
}

export function prepareOnboardingSubmit(values: SiteOnboardingValues):
  | { ok: true; data: SiteOnboardingValues }
  | { ok: false; data: SiteOnboardingValues; error: ZodError } {
  const sanitized = sanitizeOnboardingValues(values)
  const parsed = siteOnboardingSchema.safeParse(sanitized)
  if (!parsed.success) {
    return { ok: false, data: sanitized, error: parsed.error }
  }
  return { ok: true, data: parsed.data }
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

export function getCreateSiteErrorMessage(error: unknown): string {
  const err = error as { message?: string; code?: string; details?: string } | undefined
  const message = err?.message || ""
  const details = err?.details || ""
  const combined = `${message} ${details}`.toLowerCase()

  if (combined.includes("not authenticated")) {
    return "You need to sign in to create a project"
  }
  if (err?.code === "42501" || combined.includes("row-level security")) {
    return "You do not have permission to create a project"
  }
  if (combined.includes("payload") || combined.includes("too large") || combined.includes("request entity")) {
    return "The logo is too large. Try a smaller image or skip it for now."
  }
  if (message.trim()) return message
  return "Error creating project"
}

/**
 * Chrome (especially Windows) can paint autofilled values without firing React
 * onChange. Read the native inputs so Next/submit sees what the user sees.
 */
export function readAutofilledBasicFields(
  formElement: Pick<HTMLFormElement, "querySelector"> | null | undefined,
  current: { name?: string; url?: string }
): { name?: string; url?: string } {
  if (!formElement) return {}

  const nameInput = formElement.querySelector<HTMLInputElement>('input[name="name"]')
  const urlInput = formElement.querySelector<HTMLInputElement>('input[name="url"]')
  const next: { name?: string; url?: string } = {}

  if (nameInput?.value && nameInput.value !== (current.name || "")) {
    next.name = nameInput.value
  }
  if (urlInput?.value && urlInput.value !== (current.url || "")) {
    next.url = urlInput.value
  }

  return next
}
