import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { encryptMarketplacePayload, decryptMarketplacePayload } from "../encryption"
import { appIdentity, merchantCallbackUrl, platformCredentials } from "./platform"
import { merchantSessionSchema, merchantStartSchema, oauthContextSchema } from "./types"
import { buildAuthorizationUrl, exchangeAuthorization, listMerchantStores } from "./providers"
import type { AppConfig } from "./providers/types"

export function stateHash(state: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(state)) throw new Error("Invalid OAuth state")
  return createHash("sha256").update(state).digest("hex")
}

export async function beginMerchantAuthorization(input: unknown, actorId: string) {
  const value = merchantStartSchema.parse(input)
  const credentials = value.credential_mode === "platform"
    ? platformCredentials(value.provider, value.environment)
    : { client_id: value.client_id!, client_secret: value.client_secret!, integration_id: value.integration_id }
  const redirectUri = merchantCallbackUrl(value.provider)
  const state = randomBytes(32).toString("base64url")
  const verifier = randomBytes(48).toString("base64url")
  const app: AppConfig = {
    provider: value.provider, environment: value.environment, country: value.country, ...credentials,
    redirect_uri: redirectUri, webhook_url: new URL(`/api/marketplace/webhooks/${value.provider}`, redirectUri).href,
  }
  const database = await createServiceClient(true, { access: 'system' })
  const saved = await database.rpc("begin_marketplace_oauth", {
    p_context: { site_id: value.siteId, provider: value.provider, environment: value.environment,
      country: value.country, credential_mode: value.credential_mode },
    p_state_hash: stateHash(state),
    p_encrypted_context: encryptMarketplacePayload({ verifier, ...(value.credential_mode === "custom" ? { credentials } : {}) }),
    p_actor_user_id: actorId,
  })
  if (saved.error) throw new Error("Merchant authorization could not be started")
  return { url: buildAuthorizationUrl(app, state, verifier), state }
}

export async function claimMerchantAuthorization(state: string, provider: string, actorId: string) {
  const database = await createServiceClient(true, { access: 'system' })
  const { data, error } = await database.rpc("claim_marketplace_oauth", {
    p_state_hash: stateHash(state), p_provider: provider, p_actor_user_id: actorId,
  })
  if (error) throw new Error("Authorization expired, already used, or belongs to another account")
  return merchantSessionSchema.parse(data)
}

export async function failMerchantAuthorization(sessionId: string, actorId: string) {
  const database = await createServiceClient(true, { access: 'system' })
  await database.rpc("fail_marketplace_oauth", { p_session_id: sessionId, p_actor_user_id: actorId })
}

export async function completeMerchantAuthorization(
  session: ReturnType<typeof merchantSessionSchema.parse>, code: string, actorId: string,
) {
  const context = oauthContextSchema.parse(decryptMarketplacePayload(session.encrypted_context))
  const credentials = session.credential_mode === "platform"
    ? platformCredentials(session.provider, session.environment) : context.credentials
  if (!credentials) throw new Error("Application credentials unavailable")
  const redirectUri = merchantCallbackUrl(session.provider)
  const app: AppConfig = {
    provider: session.provider, environment: session.environment, country: session.country, ...credentials,
    redirect_uri: redirectUri, webhook_url: new URL(`/api/marketplace/webhooks/${session.provider}`, redirectUri).href,
  }
  const database = await createServiceClient(true, { access: 'system' })
  try {
    const authorization = await exchangeAuthorization(app, code, context.verifier)
    const stores = await listMerchantStores(app, authorization.merchant_token)
    const { data, error } = await database.rpc("complete_marketplace_oauth", {
      p_session_id: session.id,
      p_encrypted_authorization: encryptMarketplacePayload({ merchant_token: authorization.merchant_token,
        ...(session.credential_mode === "custom" ? { credentials } : {}) }),
      p_expires_at: authorization.expires_at || null, p_app_client_id_hash: appIdentity(credentials.client_id),
      p_actor_user_id: actorId, p_authorized_stores: stores,
    })
    if (error || !data?.connection_id) throw new Error("Merchant connection could not be stored")
    return { connection_id: data.connection_id as string }
  } catch {
    await database.rpc("fail_marketplace_oauth", { p_session_id: session.id, p_actor_user_id: actorId })
    throw new Error("Merchant authorization could not be completed")
  }
}