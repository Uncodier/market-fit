import * as z from "zod"
import { channelsSchema, emailChannelSchema } from "./channel-form-schema"
import { brandCommerceFields } from "./brand-commerce-schema"
import { activitiesSchema } from "./activity-settings"

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
  businessModel: z.object({
    b2b: z.boolean().optional().default(false),
    b2c: z.boolean().optional().default(false),
    b2b2c: z.boolean().optional().default(false)
  }).optional().default({ b2b: false, b2c: false, b2b2c: false }),
  currency: z.string().optional(),
  default_locale: z.enum(["en", "es", "fr", "de", "ja"]).optional(),
  about: z.string().optional(),
  company_size: z.string().optional(),
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
  industry: z.string().optional(),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    restrictions: z.object({
      enabled: z.boolean().optional().default(false),
      included_addresses: z.array(z.object({
        name: z.string().min(1, "Address name is required"),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        country: z.string().optional()
      })).optional().default([]),
      excluded_addresses: z.array(z.object({
        name: z.string().min(1, "Address name is required"),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        country: z.string().optional()
      })).optional().default([])
    }).optional().default({
      enabled: false,
      included_addresses: [],
      excluded_addresses: []
    })
  })).optional().default([]),
  // Add business hours field
  business_hours: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    timezone: z.string().min(1, "Timezone is required"),
    respectHolidays: z.boolean().optional().default(true),
    force_closed: z.boolean().optional().default(false),
    force_open_until: z.string().nullable().optional(),
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
  channels: channelsSchema,
  // Marketing related fields
  marketing_channels: z.array(marketingChannelSchema).optional().default([]),
  social_media: z.array(z.object({
    id: z.string().optional(),
    orgId: z.string().optional(),
    nickname: z.string().optional(),
    platform: z.string().min(1, "Platform is required"),
    network: z.string().optional(),
    username: z.string().optional(),
    profile_picture_url: z.string().optional(),
    network_unique_id: z.string().optional(),
    customer_social_network_id: z.number().optional(),
    accountType: z.string().optional(),
    initialImport: z.object({
      status: z.enum(["requested", "queued", "running", "completed", "partial", "failed", "unknown"]),
      limit: z.number().optional(),
      jobId: z.string().optional(),
      imported: z.number().optional(),
      failed: z.number().optional(),
      requestedAt: z.string().optional(),
      updatedAt: z.string().optional(),
    }).optional(),
    isActive: z.union([z.boolean(), z.number()]).optional().default(false),
    connectedPages: z.array(z.any()).optional(),
    createdAt: z.string().optional(),
    // Legacy fields for backward compatibility
    url: z.string().optional().default(""),
    handle: z.string().optional(),
    phone: z.string().optional(),
    phoneCode: z.string().optional(),
    inviteCode: z.string().optional(),
    channelId: z.string().optional()
  })).optional().default([]),
  team_members: z.array(z.object({
    id: z.string().optional(),
    email: z.string(),
    role: z.enum(["view", "create", "delete", "admin"], {
      required_error: "Role is required",
    }),
    name: z.string().optional(),
    position: z.string().optional(),
    blocked_screens: z.array(z.string()).optional().default([])
  })).optional().default([]),
  tracking: z.object({
    track_visitors: z.boolean().optional().default(false),
    track_actions: z.boolean().optional().default(false),
    record_screen: z.boolean().optional().default(false),
    show_cookie_consent: z.boolean().optional().default(false),
    enable_chat: z.boolean().optional().default(false),
    chat_accent_color: z.string().optional().default("#e0ff17"),
    allow_anonymous_messages: z.boolean().optional().default(false),
    chat_position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional().default("bottom-right"),
    welcome_message: z.string().optional().default("Welcome to our website! How can we assist you today?"),
    chat_title: z.string().optional().default("Chat with us"),
    analytics_provider: z.string().optional(),
    analytics_id: z.string().optional(),
    tracking_code: z.string().optional()
  }).optional().default({
    track_visitors: false,
    track_actions: false,
    record_screen: false,
    show_cookie_consent: false,
    enable_chat: false,
    chat_accent_color: "#e0ff17",
    allow_anonymous_messages: false,
    chat_position: "bottom-right",
    welcome_message: "Welcome to our website! How can we assist you today?",
    chat_title: "Chat with us",
    analytics_provider: "",
    analytics_id: "",
    tracking_code: ""
  }),
  // Billing fields
  billing: z.object({
    plan: z.enum(["commission", "engine", "foundry", "enterprise"]).default("commission"),
    addons_count: z.number().optional().default(0),
    auto_renew: z.boolean().default(true),
    card_name: z.string().optional(),
    card_number: z.string().optional(),
    card_expiry: z.string().optional(),
    card_cvc: z.string().optional(),
    billing_address: z.string().optional(),
    billing_city: z.string().optional(),
    billing_postal_code: z.string().optional(),
    billing_country: z.string().optional()
  }).optional().default({
    plan: "commission",
    auto_renew: true
  }),
  company: z.object({
    name: z.string().optional(),
    vision: z.string().optional(),
    mission: z.string().optional(),
    values: z.string().optional(),
    differentiators: z.string().optional(),
  }),
  ...brandCommerceFields,
  // Customer Journey Configuration
  customer_journey: z.object({
    awareness: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({}),
    consideration: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({}),
    decision: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({}),
    purchase: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({}),
    retention: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({}),
    referral: z.object({
      metrics: z.array(z.string()).optional().default([]),
      actions: z.array(z.string()).optional().default([]),
      tactics: z.array(z.string()).optional().default([])
    }).optional().default({})
  }).optional().default({
    awareness: { metrics: [], actions: [], tactics: [] },
    consideration: { metrics: [], actions: [], tactics: [] },
    decision: { metrics: [], actions: [], tactics: [] },
    purchase: { metrics: [], actions: [], tactics: [] },
    retention: { metrics: [], actions: [], tactics: [] },
    referral: { metrics: [], actions: [], tactics: [] }
  }),

  // Copywriting Configuration
  copywriting: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    copy_type: z.enum([
      "tweet", "cold_email", "cold_call", "sales_pitch", "follow_up_email", 
      "nurture_email", "linkedin_message", "ad_copy", "facebook_ad", "google_ad",
      "landing_page", "email_subject", "newsletter", "blog_post", "case_study",
      "testimonial", "tagline", "slogan", "product_description", "call_to_action",
      "social_post", "instagram_post", "instagram_story", "video_script", 
      "webinar_script", "press_release", "proposal", "objection_handling", 
      "faq", "blurb", "other"
    ]),
    target_audience: z.string().optional(),
    use_case: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    status: z.enum(["draft", "review", "approved", "published", "archived"]).optional().default("draft")
  })).optional().default([]),
  activities: activitiesSchema,
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
  id?: string
  orgId?: string
  nickname?: string
  platform: string
  network?: string
  username?: string
  profile_picture_url?: string
  network_unique_id?: string
  customer_social_network_id?: number
  accountType?: string
  isActive?: boolean | number
  createdAt?: string
  // Legacy fields for backward compatibility
  url?: string
  handle?: string
  phone?: string
  phoneCode?: string
  inviteCode?: string
  channelId?: string
}

export interface CopywritingItem {
  id?: string
  title: string
  content: string
  copy_type: 'tweet' | 'cold_email' | 'cold_call' | 'sales_pitch' | 'follow_up_email' | 'nurture_email' | 'linkedin_message' | 'ad_copy' | 'facebook_ad' | 'google_ad' | 'landing_page' | 'email_subject' | 'newsletter' | 'blog_post' | 'case_study' | 'testimonial' | 'tagline' | 'slogan' | 'product_description' | 'call_to_action' | 'social_post' | 'instagram_post' | 'instagram_story' | 'video_script' | 'webinar_script' | 'press_release' | 'proposal' | 'objection_handling' | 'faq' | 'blurb' | 'other'
  target_audience?: string
  use_case?: string
  notes?: string
  tags?: string[]
  status?: 'draft' | 'review' | 'approved' | 'published' | 'archived'
}

export { getFocusModeConfig } from "./focus-mode-config"
