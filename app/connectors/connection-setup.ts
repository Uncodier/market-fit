import { z } from "zod"

const oauthScheme = z.enum(["OAUTH2", "OAUTH1"])
export const hostedSetupKey = z.string().regex(/^[a-f0-9]{64}$/)
export const connectionSetupSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), config_ids: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/)).min(1).max(500) }),
  z.object({ kind: z.literal("managed_oauth"), auth_scheme: oauthScheme, setup_key: hostedSetupKey }),
  z.object({ kind: z.literal("dynamic_oauth"), auth_scheme: z.literal("DCR_OAUTH"), setup_key: hostedSetupKey }),
  z.object({ kind: z.literal("hosted_credentials"), auth_scheme: z.enum(["API_KEY", "BEARER_TOKEN", "BASIC", "BASIC_WITH_JWT"]), setup_key: hostedSetupKey }),
  z.object({ kind: z.literal("supabase_token") }),
  z.object({ kind: z.literal("no_auth") }),
  z.object({ kind: z.literal("admin_oauth") }),
  z.object({ kind: z.literal("admin_setup") }),
  z.object({ kind: z.literal("unavailable") }),
])

export const setupGuidance = {
  admin_oauth: "connectors.adminOAuthSetupHelp",
  admin_setup: "connectors.adminAuthSetupHelp",
  unavailable: "connectors.errors.connectorSetupUnavailable",
} as const

export function hostedCredentialScheme(scheme: string | undefined) {
  return scheme === "API_KEY" || scheme === "BEARER_TOKEN" || scheme === "BASIC" || scheme === "BASIC_WITH_JWT"
}