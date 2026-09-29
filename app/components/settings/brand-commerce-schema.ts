import * as z from "zod"

export const brandCommerceFields = {
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
  // Shop Storefront fields
  shop: z.object({
    hero_title: z.string().optional(),
    hero_subtitle: z.string().optional(),
    hero_cta_label: z.string().optional(),
    hero_cta_destination_type: z.enum(['scroll', 'category', 'item', 'url']).optional().default('scroll'),
    hero_cta_destination_value: z.string().optional(),
    hero_order_bar: z.boolean().optional().default(false),
    hero_image_url: z.string().optional(),
    shipping_cost: z.number().nullable().optional(),
    free_shipping_threshold: z.number().nullable().optional(),
    delivery_time_min: z.number().nullable().optional(),
    delivery_time_max: z.number().nullable().optional(),
    return_policy_summary: z.string().optional(),
    bank_account_name: z.string().optional(),
    bank_name: z.string().optional(),
    bank_routing_number: z.string().optional(),
    bank_account_number: z.string().optional(),
    trust_badges: z.array(z.object({
      title: z.string(),
      subtitle: z.string(),
      icon: z.string()
    })).max(3).optional().default([]),
    payment_methods: z.array(z.enum(['card', 'cash_on_pickup', 'bank_transfer'])).optional().default(['card', 'cash_on_pickup']),
    default_delivery_options: z.array(z.enum(['pickup', 'ship', 'none', 'dine_in'])).optional().default(['pickup', 'ship', 'dine_in']),
    bank_transfer: z.object({
      bank_name: z.string().optional(),
      account_holder: z.string().optional(),
      account_number: z.string().optional(),
      routing_number: z.string().optional(),
      instructions: z.string().optional()
    }).optional()
  }).optional().default({
    hero_title: "",
    hero_subtitle: "",
    hero_cta_label: "Shop Now",
    hero_cta_destination_type: "scroll",
    hero_cta_destination_value: "",
    hero_order_bar: false,
    hero_image_url: "",
    shipping_cost: null,
    free_shipping_threshold: null,
    delivery_time_min: null,
    delivery_time_max: null,
    return_policy_summary: "30-Day Returns",
    trust_badges: [],
    payment_methods: ['card', 'cash_on_pickup'],
    default_delivery_options: ['pickup', 'ship', 'dine_in'],
    bank_transfer: {}
  }),
  printers: z.object({
    devices: z.array(z.object({
      id: z.string(),
      name: z.string(),
      transport: z.enum(["usb", "bluetooth", "system"]),
      paperWidthMm: z.number().refine((n) => n === 58 || n === 80),
      copies: z.number().min(1).max(5),
      enabled: z.boolean().optional().default(true),
      modules: z.object({
        pos: z.boolean(),
        orders: z.boolean(),
        inventory: z.boolean(),
      }),
      autoPrint: z.object({
        posReceipt: z.boolean(),
        kitchenTicket: z.boolean(),
        orderDelta: z.boolean(),
        inventoryLabel: z.boolean(),
      }),
      station: z.object({
        workstationId: z.string(),
        workstationName: z.string(),
        hardwareName: z.string().optional(),
        bluetoothDeviceId: z.string().optional(),
        usbVendorId: z.number().optional(),
        usbProductId: z.number().optional(),
        usbKind: z.enum(["serial", "webusb"]).optional(),
        usbSerialNumber: z.string().optional(),
        boundAt: z.string().optional(),
      }).optional(),
    })).optional().default([]),
  }).optional().default({ devices: [] }),
  
}
