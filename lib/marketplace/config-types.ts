import { z } from "zod"
import type { MarketplaceProvider } from "./providers/types"

export const MARKETPLACE_COUNTRIES = ["AR", "BR", "CA", "CL", "CO", "CR", "EC", "MX", "PE", "US", "UY"] as const
export const RAPPI_COUNTRIES = ["AR", "BR", "CL", "CO", "CR", "EC", "MX", "PE", "UY"] as const
export const MARKETPLACE_PROVIDER_NAMES = { rappi: "Rappi", uber_eats: "Uber Eats" } as const
const credential = z.string().min(1).max(4096).refine(value => value.trim().length > 0)
export const marketplaceCredentialsSchema = z.object({
  client_id: credential,
  client_secret: credential,
  webhook_secret: credential.optional(),
}).strict()

export const marketplaceConfigurationSchema = z.object({
  siteId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  provider: z.enum(["rappi", "uber_eats"]),
  environment: z.enum(["sandbox", "production"]),
  country: z.enum(MARKETPLACE_COUNTRIES),
  external_store_id: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/),
  origin_location_id: z.string().uuid(),
  enabled: z.boolean(),
  manual_ready: z.boolean().default(false),
  credential_mode: z.literal("custom").default("custom"),
  client_id: credential.optional(),
  client_secret: credential.optional(),
  webhook_secret: credential.optional(),
}).strict().superRefine((input, context) => {
  if (input.provider === "rappi" && !(RAPPI_COUNTRIES as readonly string[]).includes(input.country)) {
    context.addIssue({ code: "custom", path: ["country"], message: "Unsupported Rappi country" })
  }
  if (input.provider !== "rappi" && (input.manual_ready || input.webhook_secret !== undefined)) {
    context.addIssue({ code: "custom", path: ["provider"], message: "Rappi-only option" })
  }
})

export type MarketplaceCredentials = z.infer<typeof marketplaceCredentialsSchema>
export type MarketplaceConfigurationInput = z.infer<typeof marketplaceConfigurationSchema>
export interface MarketplaceIntegrationConfig {
  id: string
  site_id: string
  provider: MarketplaceProvider
  environment: "sandbox" | "production"
  country: typeof MARKETPLACE_COUNTRIES[number]
  external_store_id: string
  origin_location_id: string
  secret_id: string | null
  credential_mode?: "platform" | "custom"
  merchant_connection_id?: string | null
  provisioning_status?: "not_ready" | "pending" | "active" | "revoked" | "failed"
  provider_batch_id?: string | null
  enabled: boolean
  manual_ready: boolean
  created_by_user_id: string
}
export interface MarketplaceIntegrationDTO {
  id: string
  site_id: string
  provider: MarketplaceProvider
  environment: "sandbox" | "production"
  country: typeof MARKETPLACE_COUNTRIES[number]
  external_store_id: string
  origin_location_id: string
  enabled: boolean
  manual_ready: boolean
  has_credentials: { client_id: boolean; client_secret: boolean; webhook_secret: boolean }
  webhook_url: string
  credential_mode?: "platform" | "custom"
  provisioning_status?: string
  merchant_connection_id?: string | null
}
export interface MarketplaceConfigurationResponse {
  integrations: MarketplaceIntegrationDTO[]
  can_manage: boolean
  locations: { id: string; name: string }[]
  platform_apps?: Record<MarketplaceProvider, { production: boolean; sandbox: boolean }>
  merchant_connections?: Array<{ id: string; provider: MarketplaceProvider; environment: "production" | "sandbox";
    country: string; credential_mode: "platform" | "custom"; status: string; stores: Array<{ id: string; name: string }> }>
}