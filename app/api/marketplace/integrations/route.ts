import { randomUUID } from "node:crypto"
import { z } from "zod"
import { requireSiteAccess, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { marketplaceConfigurationSchema, marketplaceCredentialsSchema, type MarketplaceIntegrationConfig } from "@/lib/marketplace/config-types"
import { MARKETPLACE_CONFIG_COLUMNS, marketplaceIntegrationDTO, readIntegrationCredentials } from "@/lib/marketplace/configuration"
import { encryptMarketplaceCredentials } from "@/lib/marketplace/encryption"
import { assertSameOrigin, MarketplaceRequestError, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"
import { platformReady } from "@/lib/marketplace/merchant/platform"

export const runtime = "nodejs"
const headers = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
function failure(error: unknown) {
  return error instanceof MarketplaceRequestError
    ? json({ error: error.message }, error.status)
    : json({ error: "Marketplace configuration is unavailable" }, 500)
}

export async function GET(request: Request) {
  try {
    const siteId = new URL(request.url).searchParams.get("siteId")
    if (!z.string().uuid().safeParse(siteId).success) return json({ error: "Invalid site ID" }, 400)
    const access = await requireSiteAccess(request, siteId!)
    if (access.error) return access.error
    const service = await createServiceClient(true)
    const [configs, locations, secrets] = await Promise.all([
      service.from("marketplace_integrations").select(MARKETPLACE_CONFIG_COLUMNS).eq("site_id", siteId).order("id"),
      service.from("locations").select("id,name").eq("site_id", siteId).eq("is_active", true).order("name"),
      // Presence only: never decrypt credentials for a member-facing read.
      service.from("site_secrets").select("id,use_case,provider").eq("site_id", siteId).is("instance_id", null).like("use_case", "marketplace:%"),
    ])
    if (configs.error || locations.error || secrets.error) throw new Error()
    const integrations = (configs.data || []).map((config: MarketplaceIntegrationConfig) => {
      const hasSecret = Boolean(config.merchant_connection_id) || (secrets.data || []).some((secret: { id: string; use_case: string; provider: string }) =>
        secret.id === config.secret_id && secret.use_case === `marketplace:${config.id}` && secret.provider === config.provider)
      return marketplaceIntegrationDTO(config, hasSecret, request.url)
    })
    const permission = isSiteManagerRole(access.role)
      ? await access.supabase.rpc("user_can", { p_site_id: siteId, p_command: "update" })
      : { data: false, error: null }
    return json({ integrations, locations: locations.data || [], can_manage: !permission.error && permission.data === true,
      platform_apps: {
        rappi: { production: platformReady("rappi", "production"), sandbox: platformReady("rappi", "sandbox") },
        uber_eats: { production: platformReady("uber_eats", "production"), sandbox: platformReady("uber_eats", "sandbox") },
      },
    })
  } catch (error) {
    return failure(error)
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request)
    const input = marketplaceConfigurationSchema.safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 32 * 1024)))
    if (!input.success) return json({ error: "Invalid marketplace configuration" }, 400)
    const value = input.data
    const access = await requireSiteAccess(request, value.siteId, { requireManager: true })
    if (access.error) return access.error
    const permission = await access.supabase.rpc("user_can", { p_site_id: value.siteId, p_command: "update" })
    if (permission.error || permission.data !== true) return json({ error: "Forbidden" }, 403)
    const service = await createServiceClient(true)
    const { data: location, error: locationError } = await service.from("locations").select("id")
      .eq("id", value.origin_location_id).eq("site_id", value.siteId).eq("is_active", true).maybeSingle()
    if (locationError) throw new Error()
    if (!location) return json({ error: "Choose an active location in this site" }, 400)
    let existing: MarketplaceIntegrationConfig | null = null
    if (value.integrationId) {
      const result = await service.from("marketplace_integrations").select(MARKETPLACE_CONFIG_COLUMNS)
        .eq("id", value.integrationId).eq("site_id", value.siteId).maybeSingle()
      if (result.error) throw new Error()
      if (!result.data) return json({ error: "Integration not found" }, 404)
      existing = result.data as MarketplaceIntegrationConfig
      if (existing.merchant_connection_id || existing.credential_mode === "platform") {
        return json({ error: "Manage this store through its authorized merchant connection" }, 409)
      }
      if (existing.provider !== value.provider || existing.environment !== value.environment || existing.external_store_id !== value.external_store_id) {
        return json({ error: "Provider, environment and store ID cannot be changed; add another store instead" }, 409)
      }
    }
    const id = existing?.id || randomUUID()
    const secretId = existing?.secret_id || randomUUID()
    const credentialWrite = [value.client_id, value.client_secret, value.webhook_secret].some(field => field !== undefined)
    let encrypted: string | null = null
    if (!existing || credentialWrite) {
      const previous = existing ? await readIntegrationCredentials(service, existing) : {}
      const parsed = marketplaceCredentialsSchema.safeParse({
        ...previous,
        ...(value.client_id !== undefined ? { client_id: value.client_id } : {}),
        ...(value.client_secret !== undefined ? { client_secret: value.client_secret } : {}),
        ...(value.webhook_secret !== undefined ? { webhook_secret: value.webhook_secret } : {}),
      })
      if (!parsed.success || (value.provider === "rappi" && !parsed.data.webhook_secret)) {
        return json({ error: "Client ID and client secret are required; Rappi also requires a webhook secret" }, 400)
      }
      encrypted = encryptMarketplaceCredentials(parsed.data)
    }
    const config = {
      id, site_id: value.siteId, provider: value.provider, environment: value.environment,
      country: value.country, external_store_id: value.external_store_id,
      origin_location_id: value.origin_location_id, enabled: value.enabled, manual_ready: value.manual_ready,
    }
    const saved = await service.rpc("save_marketplace_integration", {
      p_config: config, p_secret_id: secretId, p_encrypted_credentials: encrypted, p_actor_user_id: access.userId,
    })
    if (saved.error) {
      if (saved.error.code === "23505") return json({ error: "This marketplace store is already configured" }, 409)
      if (saved.error.code === "42501") return json({ error: "Forbidden" }, 403)
      throw new Error()
    }
    return json({ integration: marketplaceIntegrationDTO(saved.data as MarketplaceIntegrationConfig, true, request.url) })
  } catch (error) {
    return failure(error)
  }
}