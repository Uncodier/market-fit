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
  aliases: z.string().optional(),
  incomingServer: z.string().optional(),
  incomingPort: z.string().optional(),
  outgoingServer: z.string().optional(),
  outgoingPort: z.string().optional(),
  enabled: z.boolean().optional().default(false),
  status: z.enum(["not_configured", "password_required", "pending_sync", "synced"]).default("not_configured")
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
  // Channel settings
  channels: z.object({
    email: emailChannelSchema,
    whatsapp: z.object({
      enabled: z.boolean().default(false),
      setupType: z.enum(["new_number", "use_own_account"]).optional(),
      country: z.string().optional(),
      region: z.string().optional(), // For new_number: city code
      number: z.string().optional(), // The assigned WhatsApp number
      account_sid: z.string().optional(), // Twilio Account SID for use_own_account setup
      messaging_service_sid: z.string().optional(), // Twilio Messaging Service SID (starts with MG)
      existingNumber: z.string().optional().refine((val) => {
        if (!val || val.trim() === '') return true; // Optional field
        // Validate phone number format (international format with +)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(val.trim());
      }, {
        message: "Phone number must be in international format (e.g., +1234567890)"
      }), // For use_own_account setup type
      setupRequested: z.boolean().default(false),
      status: z.enum(["not_configured", "pending", "active"]).optional().default("not_configured")
    }).optional().default({
      enabled: false,
      setupRequested: false,
      status: "not_configured"
    }).refine((data) => {
      if (!data) return true;
      // If use_own_account setup, existingNumber and account_sid are required (apiToken is handled securely)
      if (data.setupType === "use_own_account") {
        if (!data.existingNumber || data.existingNumber.trim() === '') return false;
        if (!data.account_sid || data.account_sid.trim() === '') return false;
      }
      return true;
    }, {
      message: "Phone Number and Account SID are required for using your own Twilio account",
      path: ["setupType"]
    }),
    website: z.object({
      enabled: z.boolean().optional().default(false),
      track_visitors: z.boolean().optional().default(false),
      track_actions: z.boolean().optional().default(false),
      record_screen: z.boolean().optional().default(false),
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
      enabled: false,
      track_visitors: false,
      track_actions: false,
      record_screen: false,
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
    agent_email: z.object({
      domain: z.enum(["makinari.email", "custom"]).optional(),
      customDomain: z.string().optional(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      setupRequested: z.boolean().default(false),
      status: z.enum(["not_configured", "pending", "active", "waiting_for_verification"]).optional().default("not_configured")
    }).optional().default({
      domain: undefined,
      customDomain: "",
      username: "",
      displayName: "",
      setupRequested: false,
      status: "not_configured"
    }),
    agent_whatsapp: z.object({
      country: z.string().optional(),
      region: z.string().optional(),
      setupRequested: z.boolean().default(false),
      status: z.enum(["not_configured", "pending", "active"]).optional().default("not_configured")
    }).optional().default({
      country: "",
      region: "",
      setupRequested: false,
      status: "not_configured"
    })
  }).optional().default({
    email: {
      enabled: false,
      email: "",
      password: "",
      aliases: "",
      incomingServer: "",
      incomingPort: "",
      outgoingServer: "",
      outgoingPort: "",
      status: "not_configured" as const
    },
    whatsapp: {
      enabled: false,
      setupRequested: false,
      status: "not_configured" as const
    },
    website: {
      enabled: false,
      track_visitors: false,
      track_actions: false,
      record_screen: false,
      enable_chat: false,
      chat_accent_color: "#e0ff17",
      allow_anonymous_messages: false,
      chat_position: "bottom-right",
      welcome_message: "Welcome to our website! How can we assist you today?",
      chat_title: "Chat with us",
      analytics_provider: "",
      analytics_id: "",
      tracking_code: ""
    },
    agent_email: {
      domain: undefined,
      customDomain: "",
      username: "",
      displayName: "",
      setupRequested: false,
      status: "not_configured" as const
    },
    agent_whatsapp: {
      country: "",
      region: "",
      setupRequested: false,
      status: "not_configured" as const
    }
  }),
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
    isActive: z.union([z.boolean(), z.number()]).optional().default(false),
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
    chat_title: z.string().optional().default("Chat with us"),
    analytics_provider: z.string().optional(),
    analytics_id: z.string().optional(),
    tracking_code: z.string().optional()
  }).optional().default({
    track_visitors: false,
    track_actions: false,
    record_screen: false,
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
    plan: z.enum(["commission", "startup", "enterprise"]).default("commission"),
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
  // Branding fields
  branding: z.object({
    // Brand Pyramid (Traditional Structure)
    brand_essence: z.string().optional(), // Core essence - "Who are we?"
    brand_personality: z.string().optional(), // Personality traits
    brand_benefits: z.string().optional(), // Emotional and functional benefits
    brand_attributes: z.string().optional(), // Product/service features
    brand_values: z.string().optional(), // Company values
    brand_promise: z.string().optional(), // Brand promise to customers
    
    // Color Palette
    primary_color: z.string().optional().default("#000000"),
    secondary_color: z.string().optional().default("#666666"),
    accent_color: z.string().optional().default("#e0ff17"),
    success_color: z.string().optional().default("#22c55e"),
    warning_color: z.string().optional().default("#f59e0b"),
    error_color: z.string().optional().default("#ef4444"),
    background_color: z.string().optional().default("#ffffff"),
    surface_color: z.string().optional().default("#f8fafc"),
    
    // Typography
    primary_font: z.string().optional(),
    secondary_font: z.string().optional(),
    font_size_scale: z.enum(["small", "medium", "large"]).optional().default("medium"),
    
    // Voice and Tone
    communication_style: z.enum(["formal", "casual", "friendly", "professional", "playful"]).optional().default("friendly"),
    personality_traits: z.array(z.string()).optional().default([]),
    forbidden_words: z.array(z.string()).optional().default([]),
    preferred_phrases: z.array(z.string()).optional().default([]),
    
    // Brand Assets
    logo_variations: z.array(z.object({
      name: z.string(),
      url: z.string().optional(),
      usage: z.string().optional() // e.g., "light backgrounds", "dark backgrounds", "social media"
    })).optional().default([]),
    
    // Brand Guidelines
    do_list: z.array(z.string()).optional().default([]),
    dont_list: z.array(z.string()).optional().default([]),
    
    // Emotional Attributes
    emotions_to_evoke: z.array(z.string()).optional().default([]),
    brand_archetype: z.enum([
      "innocent", "sage", "explorer", "outlaw", "magician", "hero", 
      "lover", "jester", "everyman", "caregiver", "ruler", "creator"
    ]).optional(),
  }).optional().default({
    brand_essence: "",
    brand_personality: "",
    brand_benefits: "",
    brand_attributes: "",
    brand_values: "",
    brand_promise: "",
    primary_color: "#000000",
    secondary_color: "#666666",
    accent_color: "#e0ff17",
    success_color: "#22c55e",
    warning_color: "#f59e0b",
    error_color: "#ef4444",
    background_color: "#ffffff",
    surface_color: "#f8fafc",
    primary_font: "",
    secondary_font: "",
    font_size_scale: "medium",
    communication_style: "friendly",
    personality_traits: [],
    forbidden_words: [],
    preferred_phrases: [],
    logo_variations: [],
    do_list: [],
    dont_list: [],
    emotions_to_evoke: [],
    brand_archetype: undefined
  }),
  
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
  // Activities configuration (nested object to support future params)
  activities: z.object({
    daily_resume_and_stand_up: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    local_lead_generation: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    icp_lead_generation: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    leads_initial_cold_outreach: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    leads_follow_up: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    email_sync: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    assign_leads_to_team: z.object({ status: z.enum(["inactive", "active"]).default("inactive") }).default({ status: "inactive" }),
    notify_team_on_inbound_conversations: z.object({ status: z.enum(["default", "inactive"]).default("default") }).default({ status: "default" }),
    supervise_conversations: z.object({ status: z.enum(["inactive", "active"]).default("inactive") }).default({ status: "inactive" }),
  }).optional().default({
    daily_resume_and_stand_up: { status: "default" },
    local_lead_generation: { status: "default" },
    icp_lead_generation: { status: "default" },
    leads_initial_cold_outreach: { status: "default" },
    leads_follow_up: { status: "default" },
    email_sync: { status: "default" },
    assign_leads_to_team: { status: "inactive" },
    notify_team_on_inbound_conversations: { status: "default" },
    supervise_conversations: { status: "inactive" },
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