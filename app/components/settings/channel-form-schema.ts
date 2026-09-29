import * as z from "zod"
import { isOutreachChannel } from "@/lib/outreach-settings"

// Define the email channel schema
export const emailChannelSchema = z.object({
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

export const channelsSchema = z.object({
    email: emailChannelSchema,
    whatsapp: z.object({
      enabled: z.boolean().default(false),
      setupType: z.enum(["use_own_account"]).optional(),
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
      setupType: "use_own_account"
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
    connections: z.array(z.object({
      id: z.string().optional(),
      type: z.string().refine(value => value === "" || isOutreachChannel(value), "Use a safe channel key.").optional(),
      enabled: z.boolean().optional(),
      name: z.string().optional().default(''),
      status: z.enum(['pending', 'in_progress', 'connected', 'failed', 'expired', 'cancelled', 'disconnected', 'not_configured']).default('pending'),
      zavu_sender_id: z.string().optional(),
      zavu_invitation_id: z.string().optional(),
      connected_account: z.any().optional(),
      metadata: z.any().optional(),
      created_at: z.string().optional(),
      updated_at: z.string().optional()
    })).optional().default([]),
    website: z.object({
      enabled: z.boolean().optional().default(false),
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
      enabled: false,
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
    agent_email: z.object({
      id: z.string().optional(),
      inbox_id: z.string().optional(),
      domain: z.enum(["makinari.email", "custom"]).optional(),
      customDomain: z.string().optional(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      setupRequested: z.boolean().default(false),
      status: z.enum(["not_configured", "pending", "active", "waiting_for_verification"]).optional().default("not_configured")
    }).optional().default({
      id: undefined,
      inbox_id: undefined,
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
    connections: [],
    website: {
      enabled: false,
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
    },
    agent_email: {
      id: undefined,
      inbox_id: undefined,
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
  })
