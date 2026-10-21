import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { loadConnection } from "./connection"
import { appIdentity } from "./platform"
import { readWebhookKeys } from "./webhook-keys"
import { verifyRappiSignature, verifyUberSignature } from "../signatures"
import { parseMarketplaceJson, readMarketplaceBody } from "../request"
import { z } from "zod"
import { refreshConnectedStore } from "./reconcile"
import { uberWebhookSigningKey } from "./signing-key"

const resultSchema = z.object({ storeId: z.union([z.string(), z.number()]).transform(String),
  status: z.enum(["ACTIVE", "INACTIVE", "FAILED"]), integrationId: z.string() })

export async function receiveRappiProvisioning(request: Request, scope: { environment: string; country: string; app: string }) {
  const raw = await readMarketplaceBody(request)
  const { environment, country, app: appHash } = scope
  if (!["production", "sandbox"].includes(environment) || country !== "global" || !/^[a-f0-9]{64}$/.test(appHash)) throw new Error("Invalid provisioning scope")
  const payload = z.object({ batchId: z.string(), integrationId: z.string(), operation: z.enum(["PROVISION", "DEPROVISION"]),
    results: z.array(resultSchema).max(20) }).parse(parseMarketplaceJson(raw))
  const database = await createServiceClient(true, { access: 'system' })
  const rows = await database.from("marketplace_integrations").select("id,site_id,external_store_id,merchant_connection_id,provider_batch_id,created_by_user_id,provisioning_operation")
    .eq("provider", "rappi").eq("environment", environment).eq("provider_batch_id", payload.batchId)
  if (rows.error) throw new Error("Provisioning scope unavailable")
  let authenticated = false
  for (const row of rows.data || []) {
    if (!row.merchant_connection_id) continue
    const { app } = await loadConnection(row.merchant_connection_id, row.site_id)
    if (appIdentity(app.client_id) !== appHash) continue
    const keys = await readWebhookKeys(app)
    if (!verifyRappiSignature(raw, request.headers.get("rappi-signature"), keys.STORE_PROVISIONING_STATUS || "")) continue
    authenticated = true
    if (payload.integrationId !== app.integration_id || payload.operation !== (row.provisioning_operation === "activate" ? "PROVISION" : "DEPROVISION")) {
      throw new Error("Provisioning operation mismatch")
    }
    const result = payload.results.find(item => item.storeId === row.external_store_id)
    if (!result || result.integrationId !== app.integration_id) continue
    if (result.status === "ACTIVE" || result.status === "INACTIVE") {
      await refreshConnectedStore(row.id, row.site_id)
      continue
    }
    const finished = await database.rpc("reconcile_marketplace_provisioning", {
      p_integration_id: row.id, p_provider_batch_id: payload.batchId,
      p_status: "failed",
    })
    if (finished.error) throw new Error("Provisioning event could not be saved")
  }
  if (!authenticated) throw new Error("Invalid provisioning signature or batch")
}

export async function receiveUberProvisioning(request: Request, raw: string, payload: unknown): Promise<boolean> {
  const event = z.object({ event_type: z.enum(["store.provisioned", "store.deprovisioned"]),
    meta: z.object({ user_id: z.string().optional() }).optional(),
    user_id: z.string().optional() }).safeParse(payload)
  if (!event.success) return false
  const storeId = event.data.meta?.user_id || event.data.user_id
  if (!storeId) throw new Error("Provisioning store unavailable")
  const database = await createServiceClient(true, { access: 'system' })
  const rows = await database.from("marketplace_integrations").select("id,site_id,merchant_connection_id,created_by_user_id")
    .eq("provider", "uber_eats").eq("external_store_id", storeId)
  if (rows.error) throw new Error("Provisioning lookup unavailable")
  let authenticated = false
  for (const row of rows.data || []) {
    if (!row.merchant_connection_id) continue
    const { app, connection } = await loadConnection(row.merchant_connection_id, row.site_id)
    const signingKey = uberWebhookSigningKey({ credential_mode: connection.credential_mode,
      environment: connection.environment, client_secret: app.client_secret })
    if (!verifyUberSignature(raw, request.headers.get("x-uber-signature"), signingKey)) continue
    authenticated = true
    // A signed store event is not proof this app is the promoted order manager.
    await refreshConnectedStore(row.id, row.site_id)
  }
  if (!authenticated) throw new Error("Invalid provisioning signature")
  return true
}