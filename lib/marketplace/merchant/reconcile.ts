import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { loadConnection, requireFreshMerchantToken } from "./connection"
import { getMerchantStoreStatus, getUberStoreIntegrationStatus, registerRappiStoreWebhooks } from "./providers"
import { readWebhookKeys, saveWebhookKey } from "./webhook-keys"
import { registerWebhookConfiguration } from "./provisioning"

/** Reconciliation only: no repeated activation or deprovisioning call. */
export async function refreshConnectedStore(integrationId: string, siteId: string, actorId?: string) {
  const database = await createServiceClient(true)
  const row = await database.from("marketplace_integrations").select("*").eq("id", integrationId).eq("site_id", siteId).maybeSingle()
  if (row.error || !row.data?.merchant_connection_id) throw new Error("Merchant connection unavailable")
  const { app, connection, merchantToken } = await loadConnection(row.data.merchant_connection_id, siteId)
  if (app.provider === "rappi") requireFreshMerchantToken(connection)
  const status = app.provider === "uber_eats"
    ? await getUberStoreIntegrationStatus(app, { id: row.data.external_store_id })
    : await getMerchantStoreStatus(app, merchantToken, { id: row.data.external_store_id })
  let result: "active" | "inactive" | "pending" | undefined
  if (status.integration_status === "active") {
    if (app.provider === "rappi") {
      await registerWebhookConfiguration(app, siteId, actorId, async () => {
        await registerRappiStoreWebhooks(app, merchantToken, row.data.external_store_id, {
          existing_secrets: await readWebhookKeys(app), persist_created_secret: (event, secret) => saveWebhookKey(app, event, secret),
        })
      })
    }
    result = "active"
  } else if (status.integration_status === "inactive") result = "inactive"
  else if (status.integration_status === "pending" || status.integration_status === "other_integration") result = "pending"
  if (!result) return { status: "pending" }
  const reconciled = await database.rpc("reconcile_marketplace_provider_status", {
    p_integration_id: integrationId, p_status: result,
  })
  if (reconciled.error) throw new Error("Provisioning state could not be saved")
  return { status: reconciled.data?.provisioning_status || result }
}