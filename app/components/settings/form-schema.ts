import * as z from "zod"

// Define the marketing channel schema
const marketingChannelSchema = z.object({
  name: z.string(),
  type: z.string().optional()
})

// Define the email channel schema
const emailChannelSchema = z.object({
  email: z.string().email("Must be a valid email").optional(),
  password: z.string().optional(),
  incomingServer: z.string().optional(),
  incomingPort: z.string().optional(),
  outgoingServer: z.string().optional(),
  outgoingPort: z.string().optional(),
  enabled: z.boolean().optional().default(false)
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
    quarterly: z.string().optional(),
    yearly: z.string().optional(),
    fiveYear: z.string().optional(),
    tenYear: z.string().optional(),
  }).optional().default({
    quarterly: "",
    yearly: "",
    fiveYear: "",
    tenYear: ""
  }),
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
  marketing_budget: z.object({
    total: z.number().min(0).optional(),
    available: z.number().min(0).optional()
  }).optional().default({
    total: 0,
    available: 0
  }),
  // Channel settings
  channels: z.object({
    email: emailChannelSchema
  }).optional().default({
    email: {
      enabled: false,
      email: "",
      password: "",
      incomingServer: "",
      incomingPort: "",
      outgoingServer: "",
      outgoingPort: ""
    }
  }),
  // Marketing related fields
  marketing_channels: z.array(marketingChannelSchema).optional().default([]),
  social_media: z.array(z.object({
    platform: z.string().min(1, "Platform is required"),
    url: z.string().optional().default(""),
    handle: z.string().optional(),
    // Add fields for WhatsApp
    phone: z.string().optional(),
    phoneCode: z.string().optional(),
    // Add fields for Discord and Telegram
    inviteCode: z.string().optional(),
    channelId: z.string().optional()
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
    record_screen: z.boolean().optional().default(false),
    enable_chat: z.boolean().optional().default(false),
    chat_accent_color: z.string().optional().default("#e0ff17"),
    allow_anonymous_messages: z.boolean().optional().default(false),
    chat_position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional().default("bottom-right"),
    welcome_message: z.string().optional().default("Welcome to our website! How can we assist you today?"),
    chat_title: z.string().optional().default("Chat with us")
  }).optional().default({
    track_visitors: false,
    track_actions: false,
    record_screen: false,
    enable_chat: false,
    chat_accent_color: "#e0ff17",
    allow_anonymous_messages: false,
    chat_position: "bottom-right",
    welcome_message: "Welcome to our website! How can we assist you today?",
    chat_title: "Chat with us"
  }),
  // New fields for analytics
  analytics_provider: z.string().optional(),
  analytics_id: z.string().optional(),
  tracking_code: z.string().optional(),
  // WhatsApp Business API token
  whatsapp_token: z.string().optional(),
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
  }),
  company: z.object({
    name: z.string().optional(),
    vision: z.string().optional(),
    mission: z.string().optional(),
    values: z.string().optional(),
    differentiators: z.string().optional(),
  }),
})

export type SiteFormValues = z.infer<typeof siteFormSchema>

// Export the email channel schema type
export type EmailChannel = z.infer<typeof emailChannelSchema>

// Export types for marketing channels
export type MarketingChannel = {
  name: string;
  type?: string;
}

export interface SocialMedia {
  platform: string
  url: string
  handle?: string
  phone?: string
  phoneCode?: string
  inviteCode?: string
  channelId?: string
}

export const getFocusModeConfig = (focusMode: number) => {
  // Strong sales focus (0-25)
  if (focusMode <= 25) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-700",
      label: "Full Sales Focus",
      description: "Agents will strongly prioritize conversion and upselling opportunities.",
      features: [
        "Agents proactively suggest premium plans at every opportunity",
        "Responses heavily emphasize value proposition and ROI",
        "Examples exclusively demonstrate premium features",
        "High-value customer queries are given top priority",
        "Messaging includes strong calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-700"
    }
  }
  
  // Moderate sales focus (26-40)
  if (focusMode <= 40) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-600",
      label: "Sales Priority",
      description: "Agents will prioritize conversion opportunities while still providing good support.",
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
  
  // Slightly sales leaning (41-49)
  if (focusMode <= 49) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-500",
      label: "Sales Leaning",
      description: "Agents will balance support with a slight emphasis on sales opportunities.",
      features: [
        "Agents suggest premium plans in relevant contexts",
        "Responses mention value proposition alongside useful information",
        "Examples highlight both free and premium features, with emphasis on premium",
        "All user queries get attention, with slight priority to high-value customers",
        "Messaging includes subtle calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-500"
    }
  }
  
  // Perfect balance (50)
  if (focusMode == 50) {
    return {
      opacity: 0.5,
      color: "text-purple-600",
      label: "Perfect Balance",
      description: "Agents will maintain a perfect equilibrium between support, education and commercial opportunities.",
      features: [
        "Agents perfectly balance helpfulness and business objectives",
        "Responses give exactly equal weight to educational and commercial content",
        "Examples show balanced use cases for all user tiers",
        "All users receive identical priority and attention",
        "Messaging combines educational value with subtle commercial elements"
      ],
      sliderClass: "bg-purple-600"
    }
  }
  
  // Slightly growth leaning (51-60)
  if (focusMode <= 60) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-purple-500",
      label: "Growth Leaning",
      description: "Agents will balance commercial goals with a slight emphasis on user growth.",
      features: [
        "Agents prioritize helpfulness with occasional commercial mentions",
        "Responses focus more on educational content than business objectives",
        "Examples primarily show basic features with some premium mentions",
        "New users get slightly more attention than established ones",
        "Messaging focuses on education with minimal commercial elements"
      ],
      sliderClass: "bg-purple-500"
    }
  }
  
  // Moderate growth focus (61-75)
  if (focusMode <= 75) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-green-600",
      label: "Growth Priority",
      description: "Agents will emphasize user growth and education with minimal sales pressure.",
      features: [
        "Agents focus primarily on user satisfaction and education",
        "Responses provide in-depth guidance with minimal sales mentions",
        "Examples highlight mostly free features with few premium mentions",
        "New user onboarding is given high priority",
        "Messaging centered on user success more than commercial outcomes"
      ],
      sliderClass: "bg-green-600"
    }
  }
  
  // Strong growth focus (76-100)
  return {
    opacity: Math.max(0.1, focusMode / 100),
    color: "text-green-700",
    label: "Full Growth Focus",
    description: "Agents will exclusively focus on user satisfaction, growth and education without any sales pressure.",
    features: [
      "Agents focus exclusively on user education and satisfaction",
      "Responses provide comprehensive guidance with no sales pressure",
      "Examples only demonstrate free features and community benefits",
      "New user onboarding is the top priority",
      "Messaging completely centered on long-term user success"
    ],
    sliderClass: "bg-green-700"
  }
} 