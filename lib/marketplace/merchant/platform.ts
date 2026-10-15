import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import type { MarketplaceProvider } from "../providers/types"
import { uberWebhookSigningKey } from "./signing-key"

export type CredentialMode = "platform" | "custom"
export type Environment = "sandbox" | "production"

const appCredentials = z.object({ client_id: z.string().trim().min(1).max(4096), client_secret: z.string().trim().min(1).max(4096), integration_id: z.string().optional() })

/** Platform credentials are never stored in tenant secrets or returned to browsers. */
export function platformCredentials(provider: MarketplaceProvider, environment: Environment) {
  const prefix = provider === "uber_eats" ? "UBER_EATS" : "RAPPI"
  const suffix = environment === "sandbox" ? "_SANDBOX" : ""
  const parsed = appCredentials.safeParse({
    client_id: process.env[`${prefix}${suffix}_CLIENT_ID`],
    client_secret: process.env[`${prefix}${suffix}_CLIENT_SECRET`],
    integration_id: provider === "rappi" ? process.env[`${prefix}${suffix}_INTEGRATION_ID`]?.trim() : undefined,
  })
  if (!parsed.success) throw new Error("Makinari's marketplace application is not configured for this environment")
  if (provider === "rappi" && !parsed.data.integration_id) throw new Error("Rappi has not configured Makinari's integration ID")
  return parsed.data
}

export function platformReady(provider: MarketplaceProvider, environment: Environment): boolean {
  try {
    const credentials = platformCredentials(provider, environment)
    return provider !== "uber_eats" || Boolean(uberWebhookSigningKey({
      credential_mode: "platform", environment, client_secret: credentials.client_secret,
    }))
  } catch { return false }
}

export function appIdentity(clientId: string): string {
  return createHash("sha256").update(clientId).digest("hex")
}

export function merchantCallbackUrl(provider: MarketplaceProvider): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!base) throw new Error("The application callback origin is not configured")
  const origin = new URL(base)
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(origin.hostname)
  if ((!local && origin.protocol !== "https:") || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("The application callback origin is invalid")
  }
  return new URL(`/api/marketplace/oauth/${provider}/callback`, origin.origin).href
}