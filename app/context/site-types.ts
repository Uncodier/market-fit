"use client"

import type {
  Location,
  SwotAnalysis,
  TeamMember,
  MarketingChannel,
  SocialMedia,
  MarketingBudget,
} from "@/lib/types/database.types"
import type { BillingData } from "../services/billing-types"

export interface Site {
  id: string
  name: string
  url: string | null
  description: string | null
  logo_url: string | null
  user_id: string
  created_at: string
  updated_at: string
  resource_urls: ResourceUrl[] | null
  tracking?: {
    track_visitors: boolean;
    track_actions: boolean;
    record_screen: boolean;
    enable_chat: boolean;
    chat_accent_color?: string;
    allow_anonymous_messages?: boolean;
    chat_position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    welcome_message?: string;
    chat_title?: string;
    analytics_provider?: string;
    analytics_id?: string;
    tracking_code?: string;
  }
  billing?: {
    plan: 'commission' | 'startup' | 'enterprise'
    masked_card_number?: string
    card_name?: string
    card_expiry?: string
    stripe_customer_id?: string
    stripe_payment_method_id?: string
    card_address?: string
    card_city?: string
    card_postal_code?: string
    card_country?: string
    tax_id?: string
    billing_address?: string
    billing_city?: string
    billing_postal_code?: string
    billing_country?: string
    auto_renew: boolean
    credits_available?: number
    credits_used?: number
  }
  // New settings data
  settings?: SiteSettings
}

export interface RoundRobinCalendar {
  id: string
  name: string
  slug: string
  member_ids: string[] // user IDs
  description?: string
  location?: string
  duration: number
  buffer: number
  created_at: string
}

export interface SiteSettings {
  id?: string
  site_id?: string
  about?: string | null
  company_size?: string | null
  industry?: string | null
  products?: Product[] | null
  services?: Service[] | null
  swot?: SwotAnalysis | null
  locations?: Location[] | null
  business_hours?: BusinessHours[] | null
  marketing_budget?: MarketingBudget | null
  marketing_channels?: MarketingChannel[] | null
  social_media?: SocialMedia[] | null
  team_members?: TeamMember[] | null
  team_roles?: { name: string; permissions: string[]; description?: string }[] | null
  org_structure?: Record<string, any> | null
  currency?: string
  default_locale?: "en" | "es" | "fr" | "de" | "ja"
  created_at?: string
  updated_at?: string
  competitors?: CompetitorUrl[] | null
  focus_mode?: number
  shop?: {
    hero_title?: string
    hero_subtitle?: string
    hero_cta_label?: string
    hero_cta_destination_type?: 'scroll' | 'category' | 'item' | 'url'
    hero_cta_destination_value?: string
    hero_order_bar?: boolean
    hero_image_url?: string
    free_shipping_threshold?: number | null
    delivery_time_min?: number | null
    delivery_time_max?: number | null
    return_policy_summary?: string
    trust_badges?: any[]
    payment_methods?: string[]
    default_delivery_options?: string[]
  } | null
  business_model?: {
    b2b?: boolean
    b2c?: boolean
    b2b2c?: boolean
  } | null
  goals?: {
    quarterly?: string
    yearly?: string
    fiveYear?: string
    tenYear?: string
  } | null
  channels?: {
    email?: {
      enabled: boolean
      email: string
      password: string
      aliases?: string
      incomingServer?: string
      incomingPort?: string
      outgoingServer?: string
      outgoingPort?: string
      status?: "not_configured" | "password_required" | "pending_sync" | "synced"
    }
    whatsapp?: {
      enabled?: boolean
      setupType?: "use_own_account"
      country?: string
      region?: string
      number?: string
      existingNumber?: string
      setupRequested?: boolean
      apiToken?: string
      account_sid?: string
      messaging_service_sid?: string
      status?: "not_configured" | "pending" | "active"
    }
    agent_email?: {
      id?: string
      inbox_id?: string
      domain?: "makinari.email" | "custom"
      customDomain?: string
      username?: string
      displayName?: string
      setupRequested?: boolean
      status?: "not_configured" | "pending" | "active" | "waiting_for_verification"
      domain_id?: string
      dns_records?: Array<{
        name: string
        type: string
        value: string
        priority?: number
      }>
      domain_status?: string
      error_message?: string
      created_at?: string
      data?: {
        id?: string
        inbox_id?: string
        domain?: "makinari.email" | "custom"
        customDomain?: string
        username?: string
        displayName?: string
        domain_id?: string
        dns_records?: Array<{
          name: string
          type: string
          value: string
          priority?: number
        }>
        domain_status?: string
        error_message?: string
      }
    }
    agent_whatsapp?: {
      country?: string
      region?: string
      setupRequested?: boolean
      status?: "not_configured" | "pending" | "active"
    }
    connections?: Array<{
      id?: string
      type?: "whatsapp" | "messenger" | "sms" | "email" | "telegram" | "instagram" | "voice" | ""
      name?: string
      status: "pending" | "in_progress" | "connected" | "failed" | "expired" | "cancelled" | "disconnected" | "not_configured"
      zavu_sender_id?: string
      zavu_invitation_id?: string
      connected_account?: any
      metadata?: any
      created_at?: string
      updated_at?: string
    }>
    website?: {
      enabled?: boolean
      track_visitors?: boolean
      track_actions?: boolean
      record_screen?: boolean
      enable_chat?: boolean
      chat_accent_color?: string
      allow_anonymous_messages?: boolean
      chat_position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
      welcome_message?: string
      chat_title?: string
      analytics_provider?: string
      analytics_id?: string
      tracking_code?: string
    }
  } | null
  calendars?: RoundRobinCalendar[] | null
  shop?: {
    hero_title?: string
    hero_subtitle?: string
    hero_cta_label?: string
    hero_cta_destination_type?: 'scroll' | 'category' | 'item' | 'url'
    hero_cta_destination_value?: string
    hero_order_bar?: boolean
    hero_image_url?: string
    free_shipping_threshold?: number | null
    delivery_time_min?: number | null
    delivery_time_max?: number | null
    return_policy_summary?: string
    trust_badges?: Array<{
      title: string
      subtitle: string
      icon: string
    }>
    payment_methods?: Array<'card' | 'cash_on_pickup' | 'bank_transfer'>
    default_delivery_options?: Array<'pickup' | 'ship' | 'none' | 'dine_in'>
    bank_transfer?: {
      bank_name?: string
      account_holder?: string
      account_number?: string
      routing_number?: string
      instructions?: string
    }
  } | null
  printers?: {
    devices?: Array<{
      id: string
      name: string
      transport: "usb" | "bluetooth" | "system"
      paperWidthMm: 58 | 80
      copies: number
      enabled?: boolean
      modules: { pos: boolean; orders: boolean; inventory: boolean }
      autoPrint: {
        posReceipt: boolean
        kitchenTicket: boolean
        orderDelta: boolean
        inventoryLabel: boolean
      }
      station?: {
        workstationId: string
        workstationName: string
        hardwareName?: string
        bluetoothDeviceId?: string
        usbVendorId?: number
        usbProductId?: number
        usbKind?: "serial" | "webusb"
        usbSerialNumber?: string
        boundAt?: string
      }
    }>
  } | null
  branding?: {
    brand_essence?: string
    brand_personality?: string
    brand_benefits?: string
    brand_attributes?: string
    brand_values?: string
    brand_promise?: string
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    success_color?: string
    warning_color?: string
    error_color?: string
    background_color?: string
    surface_color?: string
    primary_font?: string
    secondary_font?: string
    font_size_scale?: "small" | "medium" | "large"
    communication_style?: "formal" | "casual" | "friendly" | "professional" | "playful"
    personality_traits?: string[]
    forbidden_words?: string[]
    preferred_phrases?: string[]
    logo_variations?: Array<{
      name: string
      url?: string
      usage?: string
    }>
    do_list?: string[]
    dont_list?: string[]
    emotions_to_evoke?: string[]
    brand_archetype?: "innocent" | "sage" | "explorer" | "outlaw" | "magician" | "hero" | "lover" | "jester" | "everyman" | "caregiver" | "ruler" | "creator"
  } | null
  customer_journey?: {
    awareness?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
    consideration?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
    decision?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
    purchase?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
    retention?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
    referral?: {
      metrics?: string[]
      actions?: string[]
      tactics?: string[]
    }
  } | null
  activities?: {
    daily_resume_and_stand_up?: 'default' | 'inactive'
    local_lead_generation?: 'default' | 'inactive'
    icp_lead_generation?: 'default' | 'inactive'
    leads_initial_cold_outreach?: 'default' | 'inactive'
    leads_follow_up?: 'default' | 'inactive'
    email_sync?: 'default' | 'inactive'
    assign_leads_to_team?: 'inactive' | 'active'
    notify_team_on_inbound_conversations?: 'default' | 'inactive'
    supervise_conversations?: 'inactive' | 'active'
  } | null
  // allowed_domains is handled in a separate table, not in settings
  // allowed_domains?: Array<{
  //   id?: string
  //   domain: string
  //   site_id?: string
  // }> | null
}

export interface ResourceUrl {
  key: string
  url: string
}

export interface BusinessHours {
  name: string
  timezone: string
  respectHolidays?: boolean
  force_closed?: boolean
  force_open_until?: string | null
  days: {
    monday: { enabled: boolean; start?: string; end?: string }
    tuesday: { enabled: boolean; start?: string; end?: string }
    wednesday: { enabled: boolean; start?: string; end?: string }
    thursday: { enabled: boolean; start?: string; end?: string }
    friday: { enabled: boolean; start?: string; end?: string }
    saturday: { enabled: boolean; start?: string; end?: string }
    sunday: { enabled: boolean; start?: string; end?: string }
  }
}

export interface CompetitorUrl {
  url: string
  name?: string
}

export interface Product {
  name: string
  description?: string
  cost?: number
  lowest_sale_price?: number
  target_sale_price?: number
}

export interface Service {
  name: string
  description?: string
  cost?: number
  lowest_sale_price?: number
  target_sale_price?: number
}

export interface SiteContextType {
  sites: Site[]
  currentSite: Site | null
  isLoading: boolean
  error: Error | null
  setCurrentSite: (site: Site) => void
  updateSite: (site: Site) => Promise<void>
  createSite: (site: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => Promise<Site>
  deleteSite: (id: string) => Promise<void>
  refreshSites: () => Promise<void>
  updateSettings: (siteId: string, settings: Partial<SiteSettings>) => Promise<void>
  getSettings: (siteId: string) => Promise<SiteSettings | null>
  updateBilling: (siteId: string, billingData: BillingData) => Promise<{ success: boolean; error?: string }>
  getBillingInfo: (siteId: string) => Promise<any>
  purchaseCredits: (siteId: string, amount: number) => Promise<{ success: boolean; error?: string }>
}
