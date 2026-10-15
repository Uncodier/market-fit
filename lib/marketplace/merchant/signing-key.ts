import "server-only"
import type { CredentialMode, Environment } from "./platform"

/** Platform HMAC configuration is independent of OAuth and never applies to another app. */
export function uberWebhookSigningKey(config: {
  credential_mode?: CredentialMode; environment: Environment; client_secret: string;
}): string {
  // Existing third-party applications retain their own app-scoped signing contract.
  if (config.credential_mode !== "platform") return config.client_secret
  const name = config.environment === "sandbox"
    ? "UBER_EATS_SANDBOX_WEBHOOK_SIGNING_KEY" : "UBER_EATS_WEBHOOK_SIGNING_KEY"
  const key = process.env[name]
  if (!key?.trim()) return ""
  if (key.length > 4096 || /[\r\n\x00]/.test(key)) throw new Error("Uber webhook signing configuration is invalid")
  return key
}