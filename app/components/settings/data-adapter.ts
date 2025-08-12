import { type Site, type SiteSettings } from "../../context/SiteContext"
import { type SiteFormValues, type MarketingChannel } from "./form-schema"

// Type definition for competitor URLs to match the form values
interface CompetitorWithMaybeOptionalName {
  url: string;
  name: string;
}

// Handle the type mismatch between our form values and the API types
export type AdaptedSiteFormValues = Omit<SiteFormValues, 'competitors'> & {
  competitors: CompetitorWithMaybeOptionalName[];
}

// Convert any existing marketing channels data to the correct format
export const formatMarketingChannels = (channels: any[]): MarketingChannel[] => {
  if (!channels || !Array.isArray(channels)) return [];
  
  return channels.map(channel => {
    if (typeof channel === 'string') {
      return { name: channel };
    } else if (typeof channel === 'object' && channel !== null) {
      return { 
        name: channel.name || '', 
        type: channel.type 
      };
    }
    return { name: '' };
  });
}

// Convert existing social media data to the new format with all fields
export const formatSocialMedia = (socialMedia: any[]): any[] => {
  if (!socialMedia || !Array.isArray(socialMedia)) return [];
  
  return socialMedia.map(sm => {
    // Ensure every social media item has the required fields
    // URL is still marked as required for backward compatibility
    const formattedItem = {
      platform: sm.platform || '',
      url: sm.url || '',
      handle: sm.handle || '',
      phone: sm.phone || '',
      phoneCode: sm.phoneCode || '',
      inviteCode: sm.inviteCode || '',
      channelId: sm.channelId || ''
    };
    
    return formattedItem;
  });
}

// Convert products data to the new format with name, description, and pricing fields
export const formatProducts = (products: any[]): any[] => {
  if (!products || !Array.isArray(products)) return [];
  
  return products.map(product => {
    // Handle migration from string to object format
    if (typeof product === 'string') {
      return {
        name: product,
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    } else if (typeof product === 'object' && product !== null) {
      return {
        name: product.name || '',
        description: product.description || '',
        cost: typeof product.cost === 'number' ? product.cost : 0,
        lowest_sale_price: typeof product.lowest_sale_price === 'number' ? product.lowest_sale_price : 0,
        target_sale_price: typeof product.target_sale_price === 'number' ? product.target_sale_price : 0
      };
    }
    return {
      name: '',
      description: '',
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    };
  });
}

// Convert services data to the new format with name, description, and pricing fields
export const formatServices = (services: any[]): any[] => {
  if (!services || !Array.isArray(services)) return [];
  
  return services.map(service => {
    // Handle migration from string to object format
    if (typeof service === 'string') {
      return {
        name: service,
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    } else if (typeof service === 'object' && service !== null) {
      return {
        name: service.name || '',
        description: service.description || '',
        cost: typeof service.cost === 'number' ? service.cost : 0,
        lowest_sale_price: typeof service.lowest_sale_price === 'number' ? service.lowest_sale_price : 0,
        target_sale_price: typeof service.target_sale_price === 'number' ? service.target_sale_price : 0
      };
    }
    return {
      name: '',
      description: '',
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    };
  });
}

// Convert locations data to the new format with restrictions field
export const formatLocations = (locations: any[]): any[] => {
  if (!locations || !Array.isArray(locations)) return [];
  
  return locations.map(location => {
    // Handle migration from old format to new format with restrictions
    if (typeof location === 'object' && location !== null) {
      return {
        name: location.name || '',
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zip: location.zip || '',
        country: location.country || '',
        restrictions: location.restrictions || {
          enabled: false,
          included_addresses: [],
          excluded_addresses: []
        }
      };
    }
    return {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      restrictions: {
        enabled: false,
        included_addresses: [],
        excluded_addresses: []
      }
    };
  });
}

// Adaptar Site a SiteFormValues para el formulario
export const adaptSiteToForm = (site: Site): AdaptedSiteFormValues => {
  console.log("Adapting site to form:", site);
  
  // Convertir los campos de goals al nuevo formato si existen
  const goalsData = site.settings?.goals 
    ? {
        quarterly: site.settings.goals.quarterly || "",
        yearly: site.settings.goals.yearly || "",
        fiveYear: site.settings.goals.fiveYear || "",
        tenYear: site.settings.goals.tenYear || ""
      }
    : {
        quarterly: "",
        yearly: "",
        fiveYear: "",
        tenYear: ""
      };

  // Check for secure tokens and use a placeholder for display
  const hasEmailPassword = site.settings?.channels?.email?.password || site.settings?.channels?.email?.enabled || "";
  const emailPassword = hasEmailPassword ? "STORED_SECURELY" : "";
  const emailStatus = (site.settings?.channels?.email?.status || (hasEmailPassword ? "synced" : "not_configured")) as "not_configured" | "password_required" | "pending_sync" | "synced";

  // Process team members data
  const teamMembers = site.settings?.team_members || [];
  console.log("🔍 ADAPT: Raw team_members from site.settings:", teamMembers);
  console.log("🔍 ADAPT: site.settings:", site.settings);
  
  // Make sure each team member has the required fields
  const processedTeamMembers = teamMembers.map(member => {
    if (!member) return null;
    
    const processed = {
      email: member.email || "",
      role: member.role || "view",
      name: member.name || "",
      position: member.position || ""
    };
    console.log("🔍 ADAPT: Processing member:", member, "→", processed);
    return processed;
  }).filter(Boolean) as {
    email: string;
    role: "view" | "create" | "delete" | "admin";
    name?: string;
    position?: string;
  }[]; // Type assertion and remove null entries
  
  console.log("🔍 ADAPT: Final processed team members:", processedTeamMembers);
  
  // Add business_hours
  const business_hours = site.settings?.business_hours?.map(bh => ({
    ...bh,
    respectHolidays: bh.respectHolidays ?? true // Ensure it's always boolean, default to true
  })) || [];
  
  console.log("🔍 ADAPT: site.settings?.business_hours:", site.settings?.business_hours)
  console.log("🔍 ADAPT: Final adapted data business_hours:", business_hours)
  
  const result = {
    name: site.name,
    url: site.url || "",
    description: site.description || "",
    logo_url: site.logo_url || "",
    resource_urls: site.resource_urls || [],
    // Leer competitors y focusMode desde settings en lugar de site
    competitors: site.settings?.competitors?.map(comp => ({
      url: comp.url || "",
      name: comp.name || "" // Ensure name is always a string
    })) || [],
    focusMode: site.settings?.focus_mode || 50,
    businessModel: (() => {
      console.log("DATA ADAPTER: Raw site.settings:", JSON.stringify(site.settings, null, 2));
      console.log("DATA ADAPTER: site.settings?.business_model:", site.settings?.business_model);
      const businessModel = {
        b2b: site.settings?.business_model?.b2b || false,
        b2c: site.settings?.business_model?.b2c || false,
        b2b2c: site.settings?.business_model?.b2b2c || false
      };
      console.log("DATA ADAPTER: Final businessModel:", businessModel);
      return businessModel;
    })(),
    // Add company info
    about: site.settings?.about || "",
    company_size: site.settings?.company_size || "",
    industry: site.settings?.industry || "",
    products: formatProducts(site.settings?.products || []),
    services: formatServices(site.settings?.services || []),
    locations: formatLocations(site.settings?.locations || []),
    // Add goals with converted field names
    goals: goalsData,
    swot: site.settings?.swot || {
      strengths: "",
      weaknesses: "",
      opportunities: "",
      threats: ""
    },
    // Add channels configuration with password placeholder if secured
    channels: site.settings?.channels ? {
      email: {
        enabled: site.settings.channels.email?.enabled || false,
        email: site.settings.channels.email?.email || "",
        password: emailPassword,
        aliases: site.settings.channels.email?.aliases || "",
        incomingServer: site.settings.channels.email?.incomingServer || "",
        incomingPort: site.settings.channels.email?.incomingPort || "",
        outgoingServer: site.settings.channels.email?.outgoingServer || "",
        outgoingPort: site.settings.channels.email?.outgoingPort || "",
        status: emailStatus
      },
      whatsapp: {
        enabled: Boolean(site.settings.channels.whatsapp?.enabled) || Boolean(site.settings.channels.whatsapp?.apiToken),
        setupType: site.settings.channels.whatsapp?.setupType,
        country: site.settings.channels.whatsapp?.country,
        region: site.settings.channels.whatsapp?.region,
        account_sid: site.settings.channels.whatsapp?.account_sid,
        existingNumber: site.settings.channels.whatsapp?.existingNumber,
        setupRequested: site.settings.channels.whatsapp?.setupRequested || false,
        status: site.settings.channels.whatsapp?.status || "not_configured"
      }
    } : {
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
        setupType: undefined,
        country: undefined,
        region: undefined,
        account_sid: undefined,
        existingNumber: undefined,
        setupRequested: false,
        status: "not_configured" as const
      }
    },
    // Add marketing info
    marketing_budget: site.settings?.marketing_budget || {
      total: 0,
      available: 0
    },
    marketing_channels: formatMarketingChannels(site.settings?.marketing_channels || []),
    social_media: formatSocialMedia(site.settings?.social_media || []),
    // Add tracking info with explicit tracking.chat_accent_color
    tracking: {
      track_visitors: site.tracking?.track_visitors || false,
      track_actions: site.tracking?.track_actions || false,
      record_screen: site.tracking?.record_screen || false,
      enable_chat: site.tracking?.enable_chat || false,
      chat_accent_color: site.tracking?.chat_accent_color || "#e0ff17",
      allow_anonymous_messages: site.tracking?.allow_anonymous_messages || false,
      chat_position: site.tracking?.chat_position || "bottom-right",
      welcome_message: site.tracking?.welcome_message || "Welcome to our website! How can we assist you today?",
      chat_title: site.tracking?.chat_title || "Chat with us",
      analytics_provider: site.tracking?.analytics_provider || "",
      analytics_id: site.tracking?.analytics_id || "",
      tracking_code: site.tracking?.tracking_code || ""
    },
    // Add team info
    team_members: processedTeamMembers,
    // Billing info
    billing: site.billing || {
      plan: "commission",
      auto_renew: true
    },
    // Agregar datos de company (este campo es requerido por el esquema)
    company: {
      name: "",
      vision: "",
      mission: "",
      values: "",
      differentiators: ""
    },
    // Add business_hours
    business_hours: business_hours,
    // Add branding data (with migration from old field names to new ones)
    branding: {
      brand_essence: (site.settings?.branding as any)?.brand_essence || (site.settings?.branding as any)?.purpose || "",
      brand_personality: (site.settings?.branding as any)?.brand_personality || (site.settings?.branding as any)?.personality || "",
      brand_benefits: (site.settings?.branding as any)?.brand_benefits || "",
      brand_attributes: (site.settings?.branding as any)?.brand_attributes || "",
      brand_values: (site.settings?.branding as any)?.brand_values || (site.settings?.branding as any)?.values || "",
      brand_promise: (site.settings?.branding as any)?.brand_promise || "",
      primary_color: site.settings?.branding?.primary_color || "#000000",
      secondary_color: site.settings?.branding?.secondary_color || "#666666",
      accent_color: site.settings?.branding?.accent_color || "#e0ff17",
      success_color: site.settings?.branding?.success_color || "#22c55e",
      warning_color: site.settings?.branding?.warning_color || "#f59e0b",
      error_color: site.settings?.branding?.error_color || "#ef4444",
      background_color: site.settings?.branding?.background_color || "#ffffff",
      surface_color: site.settings?.branding?.surface_color || "#f8fafc",
      primary_font: site.settings?.branding?.primary_font || "",
      secondary_font: site.settings?.branding?.secondary_font || "",
      font_size_scale: site.settings?.branding?.font_size_scale || "medium",
      communication_style: site.settings?.branding?.communication_style || "friendly",
      personality_traits: site.settings?.branding?.personality_traits || [],
      forbidden_words: site.settings?.branding?.forbidden_words || [],
      preferred_phrases: site.settings?.branding?.preferred_phrases || [],
      logo_variations: site.settings?.branding?.logo_variations || [],
      do_list: site.settings?.branding?.do_list || [],
      dont_list: site.settings?.branding?.dont_list || [],
      emotions_to_evoke: site.settings?.branding?.emotions_to_evoke || [],
      brand_archetype: site.settings?.branding?.brand_archetype
    },
    customer_journey: {
      awareness: {
        metrics: site.settings?.customer_journey?.awareness?.metrics || [],
        actions: site.settings?.customer_journey?.awareness?.actions || [],
        tactics: site.settings?.customer_journey?.awareness?.tactics || []
      },
      consideration: {
        metrics: site.settings?.customer_journey?.consideration?.metrics || [],
        actions: site.settings?.customer_journey?.consideration?.actions || [],
        tactics: site.settings?.customer_journey?.consideration?.tactics || []
      },
      decision: {
        metrics: site.settings?.customer_journey?.decision?.metrics || [],
        actions: site.settings?.customer_journey?.decision?.actions || [],
        tactics: site.settings?.customer_journey?.decision?.tactics || []
      },
      purchase: {
        metrics: site.settings?.customer_journey?.purchase?.metrics || [],
        actions: site.settings?.customer_journey?.purchase?.actions || [],
        tactics: site.settings?.customer_journey?.purchase?.tactics || []
      },
      retention: {
        metrics: site.settings?.customer_journey?.retention?.metrics || [],
        actions: site.settings?.customer_journey?.retention?.actions || [],
        tactics: site.settings?.customer_journey?.retention?.tactics || []
      },
      referral: {
        metrics: site.settings?.customer_journey?.referral?.metrics || [],
        actions: site.settings?.customer_journey?.referral?.actions || [],
        tactics: site.settings?.customer_journey?.referral?.tactics || []
      }
    }
  }
  
  console.log("🔍 ADAPT: Final adapted data:", result);
  return result
} 