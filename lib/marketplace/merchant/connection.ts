import "server-only"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { decryptMarketplacePayload } from "../encryption"
import { authorizationSchema, authorizedStoreSchema } from "./types"
import { appIdentity, merchantCallbackUrl, platformCredentials } from "./platform"
import type { AppConfig } from "./providers/types"

const connectionSchema = z.object({
  id: z.string().uuid(), site_id: z.string().uuid(), provider: z.enum(["rappi", "uber_eats"]),
  environment: z.enum(["production", "sandbox"]), country: z.string(), credential_mode: z.enum(["platform", "custom"]),
  app_client_id_hash: z.string(), encrypted_authorization: z.string(), token_expires_at: z.string().nullable(),
  authorized_stores: z.array(authorizedStoreSchema), status: z.enum(["authorized", "revoked"]),
})

export async function loadConnection(connectionId: string, siteId: string) {
  const database = await createServiceClient(true, { access: 'system' })
  const { data, error } = await database.from("marketplace_merchant_connections").select("*")
    .eq("id", connectionId).eq("site_id", siteId).maybeSingle()
  if (error || !data) throw new Error("Merchant authorization is unavailable")
  const connection = connectionSchema.parse(data)
  if (connection.status !== "authorized") throw new Error("Merchant authorization has been revoked")
  const authorization = authorizationSchema.parse(decryptMarketplacePayload(connection.encrypted_authorization))
  const credentials = connection.credential_mode === "platform"
    ? platformCredentials(connection.provider, connection.environment) : authorization.credentials
  if (!credentials || appIdentity(credentials.client_id) !== connection.app_client_id_hash) {
    throw new Error("The marketplace application has changed; authorize again")
  }
  const redirectUri = merchantCallbackUrl(connection.provider)
  const app: AppConfig = {
    provider: connection.provider, environment: connection.environment, country: connection.country, ...credentials,
    redirect_uri: redirectUri, webhook_url: new URL(`/api/marketplace/webhooks/${connection.provider}`, redirectUri).href,
  }
  return { connection, app, merchantToken: authorization.merchant_token }
}

export function requireFreshMerchantToken(connection: { token_expires_at: string | null }) {
  if (connection.token_expires_at && Date.parse(connection.token_expires_at) <= Date.now() + 30_000) {
    throw new Error("Merchant authorization expired. Connect the account again.")
  }
}