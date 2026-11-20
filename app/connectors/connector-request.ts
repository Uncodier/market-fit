import type { z } from "zod"

export class ConnectorRequestError extends Error {
  constructor(public code: string, public status = 0) { super(code) }
}

/** Browser calls stay on the authenticated BFF; writes are never automatically retried. */
export async function connectorRequest<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/connectors/")) throw new ConnectorRequestError("invalid_request")
  let response: Response
  try {
    response = await fetch(path, {
      ...init, cache: "no-store", credentials: "same-origin", redirect: "error",
      headers: { "Content-Type": "application/json", ...init.headers },
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ConnectorRequestError(init.method && init.method !== "GET" ? "outcome_unknown" : "unavailable")
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : "unavailable"
    throw new ConnectorRequestError(code.toLowerCase(), response.status)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new ConnectorRequestError(init.method ? "outcome_unknown" : "unavailable")
  return parsed.data
}

export function connectorErrorKey(error: unknown): string {
  if (!(error instanceof ConnectorRequestError)) return "unavailable"
  // Provider authentication is separate from the signed-in user's session.
  if (error.code === "provider_auth_failed") return "providerAuth"
  if (error.code === "storage_unavailable") return "storage"
  if (error.code === "api_not_configured" || error.code === "upstream_unavailable") return "apiUnavailable"
  if (error.code === "provider_invalid_response") return "providerResponse"
  if (error.code === "auth_config_pending") return "unknown"
  if (error.code === "managed_oauth_unavailable") return "setup"
  if (error.code === "supabase_token_rejected") return "supabaseTokenRejected"
  if (error.code === "supabase_project_unproven") return "supabaseProjectUnproven"
  if (error.code === "supabase_bind_schema") return "supabaseBindSchema"
  if (error.code === "supabase_bind_account") return "supabaseBindAccount"
  if (error.code === "supabase_bind_read") return "supabaseBindRead"
  if (error.code === "supabase_bind_identity") return "supabaseBindIdentity"
  if (error.code === "supabase_token_check_unavailable") return "supabaseTokenCheckUnavailable"
  if (error.code === "composio_project_setup_required") return "composioProjectSetup"
  if (error.status === 401) return "unauthorized"
  if (error.status === 403) return "forbidden"
  if (error.status === 404) return "notFound"
  if (error.status === 409) return "conflict"
  if (error.status === 410 || /expired/.test(error.code)) return "expired"
  if (/cancel|denied/.test(error.code)) return "cancelled"
  if (/invalid_callback/.test(error.code)) return "invalidCallback"
  if (/not_configured|setup_required|project.*verif/.test(error.code)) return "setup"
  if (/unknown|pending/.test(error.code)) return "unknown"
  return "unavailable"
}

export function scopedConnectorPath(path: string, siteId: string) {
  return `/api/connectors/${path}?${new URLSearchParams({ site_id: siteId })}`
}

export const exactToolIdPattern = /^[A-Z0-9][A-Z0-9_]{0,149}$/

export function exactToolIds(input: string): string[] | null {
  const values = [...new Set(input.split(/[\n,]/).map(value => value.trim()).filter(Boolean))]
  return values.length <= 100 && values.every(value => exactToolIdPattern.test(value)) ? values : null
}

/** The BFF validates provider hosts; this additional guard excludes active URL schemes. */
export function safeAuthorizationUrl(input: string): string | null {
  try {
    const url = new URL(input)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}