import * as z from "zod"

export function normalizeSiteUrl(raw: string): string {
  let value = (raw || "").trim().replace(/^['"]+|['"]+$/g, "")
  if (!value) return ""
  if (value.startsWith("//")) value = `https:${value}`
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  return value
}

export function isUsableSiteUrl(raw: string): boolean {
  const value = normalizeSiteUrl(raw)
  if (!value) return false
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    return parsed.hostname.replace(/\.$/, "").length > 0
  } catch {
    return false
  }
}

const money = z.coerce.number().finite().min(0).optional().catch(0)

const dayHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().optional(),
  end: z.string().optional(),
})

const addressSchema = z.object({
  name: z.string().optional().default(""),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
})

const offerSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  cost: money,
  lowest_sale_price: money,
  target_sale_price: money,
})

export const siteOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  url: z
    .string()
    .trim()
    .min(1, "Site URL is required")
    .refine(isUsableSiteUrl, "Must be a valid URL"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  focusMode: z.coerce.number().min(0).max(100).catch(50),
  business_hours: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    timezone: z.string().min(1, "Timezone is required"),
    respectHolidays: z.boolean().optional().default(true),
    days: z.object({
      monday: dayHoursSchema,
      tuesday: dayHoursSchema,
      wednesday: dayHoursSchema,
      thursday: dayHoursSchema,
      friday: dayHoursSchema,
      saturday: dayHoursSchema,
      sunday: dayHoursSchema,
    })
  })).optional().default([]),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    restrictions: z.object({
      enabled: z.boolean().optional().default(false),
      included_addresses: z.array(addressSchema).optional().default([]),
      excluded_addresses: z.array(addressSchema).optional().default([]),
    }).optional().default({
      enabled: false,
      included_addresses: [],
      excluded_addresses: [],
    })
  })).optional().default([]),
  about: z.string().optional(),
  company_size: z.string().optional(),
  industry: z.string().optional(),
  swot: z.object({
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    opportunities: z.string().optional(),
    threats: z.string().optional(),
  }).optional().default({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  }),
  goals: z.object({
    quarterly: z.string().optional(),
    yearly: z.string().optional(),
    fiveYear: z.string().optional(),
    tenYear: z.string().optional(),
  }).optional(),
  marketing_budget: z.object({
    total: money,
    available: money,
  }).optional(),
  marketing_channels: z.array(z.object({
    name: z.string(),
  })).optional().default([]),
  products: z.array(offerSchema).optional().default([]),
  services: z.array(offerSchema).optional().default([]),
})

export type SiteOnboardingValues = z.infer<typeof siteOnboardingSchema>
