import * as z from "zod"

// Define the marketing channel schema
const marketingChannelSchema = z.object({
  name: z.string(),
  type: z.string().optional()
})

export const siteFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  resource_urls: z.array(z.object({
    key: z.string().optional().default(""),
    url: z.string().url("Must be a valid URL").optional().default("")
  }).superRefine((data, ctx) => {
    // Only validate if both fields are non-empty
    if ((data.key && data.key.trim() !== '') || (data.url && data.url.trim() !== '')) {
      if (!data.key || data.key.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name is required when URL is provided",
          path: ["key"]
        });
      }
      if (!data.url || data.url.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL is required when Name is provided",
          path: ["url"]
        });
      } else if (!data.url.match(/^https?:\/\/.+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid URL",
          path: ["url"]
        });
      }
    }
  })).optional().default([]),
  competitors: z.array(z.object({
    url: z.string().url("Must be a valid URL").optional().default(""),
    name: z.string().optional().default("")
  }).superRefine((data, ctx) => {
    // Only validate if URL is non-empty
    if (data.url && data.url.trim() !== '') {
      if (!data.url.match(/^https?:\/\/.+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid URL",
          path: ["url"]
        });
      }
    }
  })).optional().default([]),
  focusMode: z.number().min(0).max(100),
  about: z.string().optional(),
  company_size: z.string().optional(),
  products: z.array(z.string()).optional().default([]),
  services: z.array(z.string()).optional().default([]),
  industry: z.string().optional(),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    country: z.string().optional()
  })).optional().default([]),
  // Add goals fields
  goals: z.object({
    quarter: z.string().optional(),
    year: z.string().optional(),
    five_year: z.string().optional(),
    ten_year: z.string().optional()
  }).optional().default({
    quarter: "",
    year: "",
    five_year: "",
    ten_year: ""
  }),
  swot: z.object({
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    opportunities: z.string().optional(),
    threats: z.string().optional()
  }).optional().default({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: ""
  }),
  marketing_budget: z.object({
    total: z.number().min(0).optional(),
    available: z.number().min(0).optional()
  }).optional().default({
    total: 0,
    available: 0
  }),
  // Marketing related fields
  marketing_channels: z.array(marketingChannelSchema).optional().default([]),
  social_media: z.array(z.object({
    platform: z.string().min(1, "Platform is required"),
    url: z.string().optional().default(""),
    handle: z.string().optional()
  }).superRefine((data, ctx) => {
    // Only validate URL if it's not empty
    if (data.url && data.url.trim() !== '') {
      if (!data.url.match(/^https?:\/\/.+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid URL starting with http:// or https://",
          path: ["url"]
        });
      }
    }
  })).optional().default([]),
  team_members: z.array(z.object({
    email: z.string().email("Must be a valid email"),
    role: z.enum(["view", "create", "delete", "admin"], {
      required_error: "Role is required",
    }),
    name: z.string().optional(),
    position: z.string().optional()
  })).optional().default([]),
  tracking: z.object({
    track_visitors: z.boolean().optional().default(false),
    track_actions: z.boolean().optional().default(false),
    record_screen: z.boolean().optional().default(false)
  }).optional().default({
    track_visitors: false,
    track_actions: false,
    record_screen: false
  }),
  // New fields for analytics
  analytics_provider: z.string().optional(),
  analytics_id: z.string().optional(),
  tracking_code: z.string().optional(),
  // Billing fields
  billing: z.object({
    plan: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
    card_number: z.string().optional(),
    card_expiry: z.string().optional(),
    card_cvc: z.string().optional(),
    card_name: z.string().optional(),
    billing_address: z.string().optional(),
    billing_city: z.string().optional(),
    billing_postal_code: z.string().optional(),
    billing_country: z.string().optional(),
    auto_renew: z.boolean().default(true)
  }).optional().default({
    plan: "free",
    auto_renew: true
  })
})

export type SiteFormValues = z.infer<typeof siteFormSchema>

// Export types for marketing channels
export type MarketingChannel = {
  name: string;
  type?: string;
}

export const getFocusModeConfig = (focusMode: number) => {
  // Strong sales focus (0-40)
  if (focusMode <= 40) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-600",
      label: "Sales Focus",
      description: "Agents will prioritize conversion opportunities while still providing quality support.",
      features: [
        "Agents regularly suggest premium plans when relevant",
        "Responses emphasize value proposition and business benefits",
        "Most examples demonstrate premium features",
        "High-value customer queries are prioritized",
        "Messaging includes clear calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-600"
    }
  }
  
  // Balanced (41-60)
  if (focusMode <= 60) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-purple-600",
      label: "Balanced",
      description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
      features: [
        "Agents perfectly balance helpfulness and business objectives",
        "Responses give equal weight to educational and commercial content",
        "Examples show balanced use cases for all user tiers",
        "All users receive identical priority and attention",
        "Messaging combines educational value with subtle commercial elements"
      ],
      sliderClass: "bg-purple-600"
    }
  }
  
  // Growth focus (61-100)
  return {
    opacity: Math.max(0.1, focusMode / 100),
    color: "text-green-600",
    label: "Growth Focus",
    description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
    features: [
      "Agents focus primarily on user satisfaction and education",
      "Responses provide in-depth guidance without sales pressure",
      "Examples highlight free features and community benefits",
      "New user onboarding is highly prioritized",
      "Messaging centered on long-term user success"
    ],
    sliderClass: "bg-green-600"
  }
} 