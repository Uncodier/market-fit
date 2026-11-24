import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { approvalInboxSchema, approvalReceipt } from "@/app/connectors/approval-contract"
import { askAccessIntent, askPolicyReceipt, directPolicyStatus, directPolicyUpdate } from "@/app/connectors/provider-direct-contract"
import { authAttemptSchema, connectorDomainCountsSchema, connectorSchema, detailSchema } from '@/app/connectors/types'
import { safeAuthorizationUrl } from '@/app/connectors/connector-request'
import { createClient } from "@/lib/supabase/server"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { connectorRoute, parseConnectorBody, parseConnectorQuery } from "./contracts"
import { clearAttemptCookie, readAttemptCookie, setAttemptCookie, tabContinuation } from "./attempt-cookie"

const headers = { "Cache-Control": "private, no-store" }
const hostedErrors = z.enum([
  "ACCESS_DENIED", "UNAUTHORIZED", "STORAGE_UNAVAILABLE", "CONNECTOR_OUTCOME_UNKNOWN", "PROVIDER_AUTH_FAILED",
  "PROVIDER_INVALID_RESPONSE", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "PROVIDER_RATE_LIMITED", "PROVIDER_NOT_FOUND",
  "PROVIDER_SETUP_REQUIRED", "PROVIDER_PROJECT_CHANGED", "PROVIDER_REVALIDATION_REQUIRED", "COMPOSIO_PROJECT_SETUP_REQUIRED",
  "AUTH_CONFIG_UNAVAILABLE", "AUTH_CONFIG_SELECTION_REQUIRED", "AUTH_CONFIG_ADMIN_REQUIRED", "AUTH_CONFIG_LIMIT",
  "AUTH_CONFIG_PENDING", "AUTH_CONFIG_SETUP_REQUIRED", "AUTH_CONFIG_PROVIDER_SETUP_REQUIRED", "AUTH_NOT_REQUIRED",
  "CONNECTOR_SETUP_UNAVAILABLE", "CONNECTORS_UNAVAILABLE", "NOT_CONFIGURED", "INVALID_REQUEST", "HOSTED_STARTS_PAUSED",
])
export function connectorProxyFailure(status: number, code = "REQUEST_FAILED", message = "Connector request could not be confirmed.") {
  return NextResponse.json({ error: { code, message } }, { status, headers })
}

export async function proxyConnector(request: NextRequest, path: string[]): Promise<Response> {
  const kind = connectorRoute(path, request.method)
  if (!kind) return connectorProxyFailure(404, "NOT_FOUND", "Connector endpoint not found.")
  const isStart = kind === "start" || kind === "start-hosted"
  if (!isSameOriginApiRequest(request)) return connectorProxyFailure(403, "ACCESS_DENIED")
  if (request.method !== "GET" && !request.headers.get("origin")) return connectorProxyFailure(403, "ORIGIN_REQUIRED")
  try {
    let body: Record<string, unknown> | undefined
    let query: Record<string, string> = {}
    let siteId: string
    const attempt = kind === "complete" ? readAttemptCookie(request, path[1]) : null
    if (request.method === "GET") {
      query = parseConnectorQuery(request.nextUrl.searchParams, kind) as Record<string, string>
      if (kind === 'connection-summary' && Object.keys(query).length !== 1) return connectorProxyFailure(400, 'INVALID_REQUEST')
      siteId = query.site_id
    } else {
      if ((isStart || kind === "provider-direct") && request.nextUrl.search) return connectorProxyFailure(400, "INVALID_REQUEST")
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return connectorProxyFailure(415, "JSON_REQUIRED")
      body = parseConnectorBody(kind, JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, kind === "provider-direct" ? 2048 : 32_768))))
      if (kind === "complete") {
        if (!attempt) return connectorProxyFailure(403, "AUTH_ATTEMPT_EXPIRED", "Start authentication again in this browser.")
        if (body.session_uri && body.continuation !== tabContinuation(path[1], attempt.nonce)) return connectorProxyFailure(403, "ACCESS_DENIED")
        body = { ...body, site_id: attempt.site_id, nonce: attempt.nonce }
      }
      siteId = body.site_id as string
    }
    const ask = kind === "policy" && body?.ask_access ? askAccessIntent.parse(body.ask_access) : undefined
    if (ask && request.nextUrl.search) return connectorProxyFailure(400, "INVALID_REQUEST")
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return connectorProxyFailure(401, "UNAUTHORIZED")
    if (attempt && attempt.user_id !== user.id) return connectorProxyFailure(403, "ACCESS_DENIED")
    // This actor-bound RPC owns connector membership, co-owner, license, screen
    // and unscoped-location rules. Do not fall back to a weaker generic role check.
    const screen = await supabase.rpc("connector_site_access", { p_site_id: siteId, p_user_id: user.id })
    if (screen.error && kind === "complete" && body?.hosted_credentials) return connectorProxyFailure(503, "CREDENTIAL_CHECK_UNAVAILABLE")
    if (screen.error) return connectorProxyFailure(503, "STORAGE_UNAVAILABLE", "Connector storage is not ready.")
    const permission = Array.isArray(screen.data) ? screen.data[0] : screen.data
    const managerOnly = request.method !== "GET" || ["attempt", "approval-inbox", "provider-direct"].includes(kind)
    if (permission?.can_view !== true || (managerOnly && permission.can_manage !== true)) return connectorProxyFailure(403, "ACCESS_DENIED")
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.access_token || session.user?.id !== user.id) return connectorProxyFailure(401, "UNAUTHORIZED")
    const target = configuredApiUrl(request, `/api/connectors/${path.map(encodeURIComponent).join("/")}`)
    if (!target) return connectorProxyFailure(503, "API_NOT_CONFIGURED")
    Object.entries(query).forEach(([key, value]) => target.searchParams.set(key, value))
    const nonce = isStart ? randomBytes(32).toString("hex") : undefined
    if (nonce) body = { ...body, nonce }
    let upstream: Response
    try {
      upstream = await fetch(target, {
        method: request.method, redirect: "error", cache: "no-store",
        headers: { authorization: `Bearer ${session.access_token}`, "content-type": "application/json", accept: "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(kind === "supabase-token" || kind === "start-hosted" ? 60_000 : 30_000)]),
      })
    } catch {
      return connectorProxyFailure(502, request.method === "GET" ? "UPSTREAM_UNAVAILABLE" : "OUTCOME_UNKNOWN", "Request outcome could not be confirmed. Reload before retrying.")
    }
    let payload: unknown
    try { payload = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, kind === "provider-direct" ? 2048 : 2_000_000))) }
    catch (error) {
      if (ask || kind === "provider-direct") return connectorProxyFailure(502, body ? "OUTCOME_UNKNOWN" : "INVALID_RESPONSE")
      if (isStart || kind === "complete" || kind === "supabase-token" || kind === "approval-decision") return connectorProxyFailure(502, "OUTCOME_UNKNOWN")
      throw error
    }
    if (!upstream.ok) {
      if (kind === "start-hosted") {
        const failure = z.object({ error: z.object({ code: hostedErrors }) }).safeParse(payload)
        return connectorProxyFailure(upstream.status, failure.success ? failure.data.error.code : undefined)
      }
      if (ask || kind === "provider-direct") {
        const status = [400, 401, 403, 404, 409, 415, 422, 429, 503].includes(upstream.status) ? upstream.status : 502
        // Do not reflect operator/provider details (including arbitrary error codes) to the browser.
        const failure = z.object({ error: z.object({ code: z.enum(["DIRECT_ATTESTATION_REQUIRED", "ASK_INCOMPATIBLE", "REVISION_CONFLICT", "STORAGE_UNAVAILABLE"]) }) }).safeParse(payload)
        return connectorProxyFailure(status, failure.success ? failure.data.error.code : undefined)
      }
      const failure = z.object({ error: z.object({ code: z.string().regex(/^[A-Z0-9_]{1,80}$/), message: z.string().max(300) }) }).safeParse(payload)
      if (failure.success) return connectorProxyFailure(upstream.status, failure.data.error.code, isStart || kind === "supabase-token" ? undefined : failure.data.error.message)
      return connectorProxyFailure([400, 401, 403, 404, 409, 422, 429, 503].includes(upstream.status) ? upstream.status : 502)
    }
    if (ask) {
      const receipt = askPolicyReceipt(path[1], Number(body?.expected_revision), ask).safeParse(payload)
      return receipt.success ? NextResponse.json(receipt.data, { headers }) : connectorProxyFailure(502, "OUTCOME_UNKNOWN")
    }
    if (kind === "provider-direct") {
      const result = directPolicyStatus(path[1], body ? directPolicyUpdate.parse(body) : undefined).safeParse(payload)
      return result.success ? NextResponse.json(result.data, { headers }) : connectorProxyFailure(502, body ? "OUTCOME_UNKNOWN" : "INVALID_RESPONSE")
    }
    if (kind === 'connection-summary') {
      const summary = connectorSchema.safeParse(payload)
      return summary.success && summary.data.id === path[1] ? NextResponse.json(summary.data, { headers }) : connectorProxyFailure(502, 'INVALID_RESPONSE')
    }
    if (kind === "domain-counts") {
      const counts = connectorDomainCountsSchema.safeParse(payload)
      return counts.success ? NextResponse.json(counts.data, { headers }) : connectorProxyFailure(502, "INVALID_RESPONSE")
    }
    if (request.method === "GET" && path[0] === "catalog" && path.length === 2) {
      const detail = detailSchema.safeParse(payload)
      if (!detail.success || detail.data.toolkit.slug !== path[1]) return connectorProxyFailure(502, "INVALID_RESPONSE")
      const manager = permission.can_manage === true && detail.data.can_manage
      if (!manager) {
        const { connection_setup, ...publicDetail } = detail.data
        return NextResponse.json({ ...publicDetail, can_manage: false, can_create_managed_oauth: false, auth_configs: [],
          ...(connection_setup?.kind === "no_auth" && { connection_setup }) }, { headers })
      }
      return NextResponse.json(detail.data, { headers })
    }
    if (nonce) {
      const started = authAttemptSchema.safeParse(payload)
      const redirect_url = started.success && safeAuthorizationUrl(started.data.redirect_url)
      if (!started.success || !redirect_url) return connectorProxyFailure(502, "OUTCOME_UNKNOWN")
      const continuation = tabContinuation(started.data.attempt_id, nonce)
      const response = NextResponse.json({ attempt_id: started.data.attempt_id, continuation, redirect_url }, { headers })
      setAttemptCookie(response, started.data.attempt_id, { site_id: siteId, user_id: user.id, nonce })
      return response
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return connectorProxyFailure(502, "INVALID_RESPONSE")
    if (kind === "approval-inbox" || kind === "approval-decision") {
      const schema = kind === "approval-inbox" ? approvalInboxSchema : approvalReceipt(path[1], path[2] === "approve" ? "approve" : "reject")
      const result = schema.safeParse(payload)
      return result.success ? NextResponse.json(result.data, { headers }) : connectorProxyFailure(502, kind === "approval-decision" ? "OUTCOME_UNKNOWN" : "INVALID_RESPONSE")
    }
    if (kind === "supabase-token") {
      const result = z.object({ status: z.literal("completed"), connector_id: z.string().uuid() }).safeParse(payload)
      return result.success ? NextResponse.json(result.data, { headers }) : connectorProxyFailure(502, "OUTCOME_UNKNOWN")
    }
    if (kind === "complete") {
      const receipt = z.object({ status: z.literal("completed"), connector_id: z.string().uuid(), toolkit_slug: z.string().regex(/^[a-z0-9_][a-z0-9_-]{0,99}$/) }).safeParse(payload)
      if (!receipt.success) return connectorProxyFailure(502, "OUTCOME_UNKNOWN")
      const response = NextResponse.json({ ...receipt.data, site_id: siteId }, { headers })
      clearAttemptCookie(response, path[1])
      return response
    }
    return NextResponse.json(payload, { headers })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return connectorProxyFailure(413, "REQUEST_TOO_LARGE")
    if (error instanceof z.ZodError || error instanceof SyntaxError) return connectorProxyFailure(400, "INVALID_REQUEST")
    return connectorProxyFailure(503, "CONNECTORS_UNAVAILABLE")
  }
}