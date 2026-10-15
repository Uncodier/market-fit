import { z } from "zod"
import { MARKETPLACE_COUNTRIES, RAPPI_COUNTRIES } from "../config-types"

export const merchantStartSchema = z.object({
  siteId: z.string().uuid(),
  provider: z.enum(["uber_eats", "rappi"]),
  environment: z.enum(["production", "sandbox"]),
  country: z.enum(MARKETPLACE_COUNTRIES),
  credential_mode: z.enum(["platform", "custom"]).default("platform"),
  client_id: z.string().trim().min(1).max(4096).optional(),
  client_secret: z.string().trim().min(1).max(4096).optional(),
  integration_id: z.string().trim().min(1).max(200).optional(),
}).strict().superRefine((input, context) => {
  if (input.provider === "rappi" && !(RAPPI_COUNTRIES as readonly string[]).includes(input.country)) {
    context.addIssue({ code: "custom", message: "Unsupported country", path: ["country"] })
  }
  if (input.credential_mode === "platform" && (input.client_id || input.client_secret || input.integration_id)) {
    context.addIssue({ code: "custom", message: "Platform credentials cannot be overridden", path: ["credential_mode"] })
  }
  if (input.credential_mode === "custom" && (!input.client_id || !input.client_secret)) {
    context.addIssue({ code: "custom", message: "Custom application credentials are required", path: ["client_id"] })
  }
  if (input.credential_mode === "custom" && input.provider === "rappi" && !input.integration_id) {
    context.addIssue({ code: "custom", message: "The Rappi integration ID is required", path: ["integration_id"] })
  }
})

export const authorizedStoreSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), name: z.string().min(1).max(1000),
  integrated: z.boolean().optional(), integration_id: z.string().optional(),
  integration_status: z.enum(["active", "inactive", "pending", "other_integration"]).optional(),
  parent_id: z.string().optional(),
  location: z.object({ address: z.string().optional(), city: z.string().optional(), country: z.string().optional(), postal_code: z.string().optional() }).optional(),
})

export const merchantSessionSchema = z.object({
  id: z.string().uuid(), site_id: z.string().uuid(), user_id: z.string().uuid(),
  provider: z.enum(["uber_eats", "rappi"]), environment: z.enum(["production", "sandbox"]),
  country: z.enum(MARKETPLACE_COUNTRIES), credential_mode: z.enum(["platform", "custom"]),
  encrypted_context: z.string(), expires_at: z.string(), status: z.string(),
})
export const authorizationSchema = z.object({
  merchant_token: z.string().min(1).max(32768),
  credentials: z.object({ client_id: z.string(), client_secret: z.string(), integration_id: z.string().optional() }).optional(),
})
export const oauthContextSchema = z.object({
  verifier: z.string().min(43).max(128),
  credentials: z.object({ client_id: z.string(), client_secret: z.string(), integration_id: z.string().optional() }).optional(),
})

export type AuthorizedStore = z.infer<typeof authorizedStoreSchema>