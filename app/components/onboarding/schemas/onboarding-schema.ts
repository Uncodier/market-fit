import * as z from "zod"

export const siteOnboardingSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  focusMode: z.number().min(0).max(100),
  business_hours: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    timezone: z.string().min(1, "Timezone is required"),
    respectHolidays: z.boolean().optional().default(true),
    days: z.object({
      monday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      tuesday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      wednesday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      thursday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      friday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      saturday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      sunday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      })
    })
  })).optional().default([]),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional()
  })).optional().default([]),
  // Company info
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
    threats: ""
  }),
  goals: z.object({
    quarterly: z.string().optional(),
    yearly: z.string().optional(),
    fiveYear: z.string().optional(),
    tenYear: z.string().optional(),
  }).optional(),
  // Marketing info
  marketing_budget: z.object({
    total: z.number().optional(),
    available: z.number().optional(),
  }).optional(),
  marketing_channels: z.array(z.object({
    name: z.string(),
  })).optional().default([]),
  products: z.array(z.object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    cost: z.number().min(0, "Cost must be positive").optional(),
    lowest_sale_price: z.number().min(0, "Lowest sale price must be positive").optional(),
    target_sale_price: z.number().min(0, "Target sale price must be positive").optional()
  })).optional().default([]),
  services: z.array(z.object({
    name: z.string().min(1, "Service name is required"),
    description: z.string().optional(),
    cost: z.number().min(0, "Cost must be positive").optional(),
    lowest_sale_price: z.number().min(0, "Lowest sale price must be positive").optional(),
    target_sale_price: z.number().min(0, "Target sale price must be positive").optional()
  })).optional().default([]),
})

export type SiteOnboardingValues = z.infer<typeof siteOnboardingSchema> 