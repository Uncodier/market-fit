import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { decryptMarketplacePayload, encryptMarketplacePayload } from "../encryption"
import { appIdentity } from "./platform"
import type { AppConfig, RappiWebhookEvent, RappiWebhookSecrets } from "./providers/types"

export async function readWebhookKeys(app: AppConfig): Promise<RappiWebhookSecrets> {
  const database = await createServiceClient(true)
  const { data, error } = await database.from("marketplace_provider_webhook_keys").select("event,secret_ciphertext")
    .eq("app_client_id_hash", appIdentity(app.client_id)).eq("provider", app.provider)
    .eq("environment", app.environment).is("country", null).is("integration_id", null)
  if (error) throw new Error("Webhook registry unavailable")
  const keys: RappiWebhookSecrets = {}
  for (const row of data || []) {
    const secret = decryptMarketplacePayload(row.secret_ciphertext)
    if (typeof secret !== "string" || !secret) throw new Error("Webhook secret unavailable")
    keys[row.event as RappiWebhookEvent] = secret
  }
  return keys
}

export async function saveWebhookKey(app: AppConfig, event: RappiWebhookEvent, secret: string) {
  const database = await createServiceClient(true)
  const { error } = await database.from("marketplace_provider_webhook_keys").upsert({
    app_client_id_hash: appIdentity(app.client_id), provider: app.provider, environment: app.environment,
    country: null, integration_id: null, event, secret_ciphertext: encryptMarketplacePayload(secret),
  }, { onConflict: "app_client_id_hash,provider,environment,country,integration_id,event", ignoreDuplicates: true })
  if (error) throw new Error("Webhook secret could not be persisted")
}