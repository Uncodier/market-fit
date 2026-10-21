import "server-only"
import { randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { loadConnection, requireFreshMerchantToken } from "./connection"
import { appIdentity } from "./platform"
import { readWebhookKeys, saveWebhookKey } from "./webhook-keys"
import { activateMerchantStore, deactivateMerchantStore, getMerchantStoreStatus,
  registerRappiProvisioningWebhook, registerRappiStoreWebhooks } from "./providers"
import type { AppConfig } from "./providers/types"

export async function registerWebhookConfiguration(app: AppConfig, siteId: string, actorId: string | undefined, work: () => Promise<void>) {
  const database = await createServiceClient(true, { access: 'system' })
  const claimed = await database.rpc("claim_marketplace_webhook_registration", {
    p_app_hash: appIdentity(app.client_id), p_provider: app.provider, p_environment: app.environment,
    p_country: null, ...(actorId ? { p_actor_user_id: actorId, p_site_id: siteId } : {}),
  })
  if (claimed.error || claimed.data?.acquired !== true) throw new Error("Webhook registration is busy or requires reconciliation")
  try {
    await work()
    const finished = await database.rpc("finish_marketplace_webhook_registration_app", { p_claim_id: claimed.data.claim_id, p_result: "ready" })
    if (finished.error) throw new Error("Webhook registration could not be confirmed")
  } catch {
    await database.rpc("finish_marketplace_webhook_registration_app", { p_claim_id: claimed.data.claim_id, p_result: "unknown" })
    throw new Error("Webhook registration requires reconciliation; no retry was issued")
  }
}

async function prepareRappiProvisioning(app: AppConfig, siteId: string, actorId: string) {
  const callback = new URL(`/api/marketplace/oauth/rappi/events/${app.environment}/global/${appIdentity(app.client_id)}`, app.redirect_uri)
  const registrationApp = { ...app, webhook_url: callback.href }
  await registerWebhookConfiguration(app, siteId, actorId, async () => {
    const keys = await readWebhookKeys(app)
    await registerRappiProvisioningWebhook(registrationApp, {
      existing_secrets: keys,
      persist_created_secret: (event, secret) => saveWebhookKey(app, event, secret),
    })
  })
}

export async function activateConnectedStore(input: {
  connection_id: string; site_id: string; external_store_id: string; origin_location_id: string;
}, actorId: string) {
  const { connection, app, merchantToken } = await loadConnection(input.connection_id, input.site_id)
  requireFreshMerchantToken(connection)
  const store = await getMerchantStoreStatus(app, merchantToken, { id: input.external_store_id })
  if (store.integration_status === "other_integration") throw new Error("This store is connected to another integration")
  const database = await createServiceClient(true, { access: 'system' })
  const existing = await database.from("marketplace_integrations").select("id,site_id,merchant_connection_id,provisioning_status,enabled,manual_ready")
    .eq("provider", connection.provider).eq("environment", connection.environment).eq("external_store_id", store.id).maybeSingle()
  if (existing.error) throw new Error("Store connection unavailable")
  if (existing.data && existing.data.site_id !== input.site_id) throw new Error("This store is already connected elsewhere")
  if (existing.data && existing.data.merchant_connection_id !== connection.id) {
    const rebound = await database.rpc("rebind_marketplace_merchant_connection", {
      p_integration_id: existing.data.id, p_connection_id: connection.id, p_actor_user_id: actorId,
    })
    if (rebound.error) throw new Error("The store could not be reauthorized; disconnect a different application first")
  }
  const id = existing.data?.id || randomUUID()
  const saved = await database.rpc("save_marketplace_integration", {
    p_config: { id, site_id: input.site_id, provider: connection.provider, environment: connection.environment,
      country: connection.country, external_store_id: store.id, origin_location_id: input.origin_location_id,
      credential_mode: connection.credential_mode, merchant_connection_id: connection.id,
      provisioning_status: "not_ready", enabled: existing.data?.enabled || false, manual_ready: existing.data?.manual_ready || false },
    p_secret_id: null, p_encrypted_credentials: null, p_actor_user_id: actorId,
  })
  if (saved.error) throw new Error("Store connection could not be saved")
  const claim = await database.rpc("claim_marketplace_provisioning", {
    p_integration_id: id, p_operation: "activate", p_actor_user_id: actorId,
  })
  if (claim.error) throw new Error("Store activation is unavailable")
  if (claim.data.duplicate) return { integration_id: id, status: claim.data.integration?.provisioning_status === "active" ? "active" : "pending" }
  try {
    if (connection.provider === "rappi") await prepareRappiProvisioning(app, input.site_id, actorId)
    const result = await activateMerchantStore(app, merchantToken, store, {
      integrator_store_id: input.origin_location_id, integrator_brand_id: input.site_id, is_order_manager: true,
    })
    if (result.status === "active" && connection.provider === "rappi") {
      await registerWebhookConfiguration(app, input.site_id, actorId, async () => {
        await registerRappiStoreWebhooks(app, merchantToken, store.id, {
          existing_secrets: await readWebhookKeys(app), persist_created_secret: (event, secret) => saveWebhookKey(app, event, secret),
        })
      })
    }
    const finish = await database.rpc("finish_marketplace_provisioning", {
      p_integration_id: id, p_batch_id: claim.data.batch_id, p_result: result.status === "active" ? "confirmed" : "pending",
      p_actor_user_id: actorId, p_provider_batch_id: result.batch_id || null,
    })
    if (finish.error) throw new Error("Activation result could not be committed")
    return { integration_id: id, status: result.status }
  } catch {
    await database.rpc("finish_marketplace_provisioning", {
      p_integration_id: id, p_batch_id: claim.data.batch_id, p_result: "unknown", p_actor_user_id: actorId,
      p_provider_batch_id: null,
    })
    throw new Error("Activation is pending or uncertain. Refresh the provider status; do not repeat the request.")
  }
}

export async function deactivateConnectedStore(integrationId: string, siteId: string, actorId: string) {
  const database = await createServiceClient(true, { access: 'system' })
  const row = await database.from("marketplace_integrations").select("id,merchant_connection_id,external_store_id")
    .eq("id", integrationId).eq("site_id", siteId).maybeSingle()
  if (row.error || !row.data?.merchant_connection_id) throw new Error("Store connection unavailable")
  const { connection, app, merchantToken } = await loadConnection(row.data.merchant_connection_id, siteId)
  requireFreshMerchantToken(connection)
  const claim = await database.rpc("claim_marketplace_provisioning", {
    p_integration_id: integrationId, p_operation: "deactivate", p_actor_user_id: actorId,
  })
  if (claim.error) throw new Error("Store disconnect unavailable")
  if (claim.data.duplicate) return { status: "pending" }
  try {
    const result = await deactivateMerchantStore(app, merchantToken, { id: row.data.external_store_id })
    const finish = await database.rpc("finish_marketplace_provisioning", {
      p_integration_id: integrationId, p_batch_id: claim.data.batch_id, p_result: "pending",
      p_actor_user_id: actorId, p_provider_batch_id: result.batch_id || null,
    })
    if (finish.error) throw new Error()
    return { status: "pending" }
  } catch {
    await database.rpc("finish_marketplace_provisioning", {
      p_integration_id: integrationId, p_batch_id: claim.data.batch_id, p_result: "unknown",
      p_actor_user_id: actorId, p_provider_batch_id: null,
    })
    throw new Error("Disconnect result is uncertain; refresh before retrying")
  }
}