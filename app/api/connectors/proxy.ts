import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { approvalInboxSchema, approvalReceipt } from "@/app/connectors/approval-contract"
import { connectorSchema } from '@/app/connectors/types'
import { createClient } from "@/lib/supabase/server"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { connectorRoute, parseConnectorBody, parseConnectorQuery } from "./contracts"
import { clearAttemptCookie, readAttemptCookie, setAttemptCookie } from "./attempt-cookie"

const headers = { "Cache-Control": "private, no-store" }
export function connectorProxyFailure(status: number, code = "REQUEST_FAILED", message = "Connector request could not be confirmed.") {
  return NextResponse.json({ error: { code, message } }, { status, headers })
}

export async function proxyConnector(request: NextRequest, path: string[]): Promise<Response> {
  const kind = connectorRoute(path, request.method)
  if (!kind) return connectorProxyFailure(404, "NOT_FOUND", "Connector endpoint not found.")
  if (!isSameOriginApiRequest(request)) return connectorProxyFailure(403, "ACCESS_DENIED")
  if (request.method !== "GET" && !request.headers.get("origin")) return connectorProxyFailure(403, "ORIGIN_REQUIRED")
  try {
    let body: Record<string, unknown> | undefined
    let query: Record<string, string> = {}
    let siteId: string
    const attempt = kind === "complete" ? readAttemptCookie(request, path[1]) : null
    if (request.method === "GET") {
      query = parseConnectorQuery(request.nextUrl.searchParams) as Record<string, string>
      if (kind === 'connection-summary' && Object.keys(query).length !== 1) return connectorProxyFailure(400, 'INVALID_REQUEST')
      siteId = query.site_id
    } else {
      if (kind === "bind-project" && request.nextUrl.search) return connectorProxyFailure(400, "INVALID_REQUEST")
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return connectorProxyFailure(415, "JSON_REQUIRED")
      body = parseConnectorBody(kind, JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 32_768))))
      if (kind === "complete") {
        if (!attempt) return connectorProxyFailure(403, "AUTH_ATTEMPT_EXPIRED", "Start authentication again in this browser.")
        body = { ...body, site_id: attempt.site_id, nonce: attempt.nonce }
      }
      siteId = body.site_id as string
    }
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return connectorProxyFailure(401, "UNAUTHORIZED")
    if (attempt && attempt.user_id !== user.id) return connectorProxyFailure(403, "ACCESS_DENIED")
    // This actor-bound RPC owns connector membership, co-owner, license, screen
    // and unscoped-location rules. Do not fall back to a weaker generic role check.
    const screen = await supabase.rpc("connector_site_access", { p_site_id: siteId, p_user_id: user.id })
    if (screen.error) return connectorProxyFailure(503, "STORAGE_UNAVAILABLE", "Connector storage is not ready.")
    const permission = Array.isArray(screen.data) ? screen.data[0] : screen.data
    if (permission?.can_view !== true || ((request.method !== "GET" || kind === "attempt" || kind === "approval-inbox") && permission.can_manage !== true)) return connectorProxyFailure(403, "ACCESS_DENIED")
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.access_token || session.user?.id !== user.id) return connectorProxyFailure(401, "UNAUTHORIZED")
    const target = configuredApiUrl(request, `/api/connectors/${path.map(encodeURIComponent).join("/")}`)
    if (!target) return connectorProxyFailure(503, "API_NOT_CONFIGURED")
    Object.entries(query).forEach(([key, value]) => target.searchParams.set(key, value))
    const nonce = kind === "start" ? randomBytes(32).toString("hex") : undefined
    if (nonce) body = { ...body, nonce }
    let upstream: Response
    try {
      upstream = await fetch(target, {
        method: request.method, redirect: "error", cache: "no-store",
        headers: { authorization: `Bearer ${session.access_token}`, "content-type": "application/json", accept: "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(kind === "supabase-token" ? 60_000 : 30_000)]),
      })
    } catch {
      return connectorProxyFailure(502, request.method === "GET" ? "UPSTREAM_UNAVAILABLE" : "OUTCOME_UNKNOWN", "Request outcome could not be confirmed. Reload before retrying.")
    }
    let payload: unknown
    try { payload = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 2_000_000))) }
    catch (error) {
      if (kind === "supabase-token" || kind === "approval-decision" || kind === "bind-project") return connectorProxyFailure(502, "OUTCOME_UNKNOWN")
      throw error
    }
    if (!upstream.ok) {
      const failure = z.object({ error: z.object({ code: z.string().regex(/^[A-Z0-9_]{1,80}$/), message: z.string().max(300) }) }).safeParse(payload)
      if (failure.success) return connectorProxyFailure(upstream.status, failure.data.error.code, ["supabase-token", "bind-project"].includes(kind) ? undefined : failure.data.error.message)
      return connectorProxyFailure([400, 401, 403, 404, 409, 422, 429, 503].includes(upstream.status) ? upstream.status : 502)
    }
    if (kind === "bind-project") {
      const receipt = z.object({ connector_id: z.literal(path[1]), revision: z.literal(Number(body?.expected_revision) + 1) }).safeParse(payload)
      return receipt.success ? NextResponse.json(receipt.data, { headers }) : connectorProxyFailure(502, "OUTCOME_UNKNOWN")
    }
    if (kind === 'connection-summary') {
      const summary = connectorSchema.safeParse(payload)
      return summary.success && summary.data.id === path[1] ? NextResponse.json(summary.data, { headers }) : connectorProxyFailure(502, 'INVALID_RESPONSE')
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
    const response = NextResponse.json(payload, { headers })
    if (nonce) {
      const started = z.object({ attempt_id: z.string().uuid(), redirect_url: z.string().url() }).parse(payload)
      const redirect = new URL(started.redirect_url)
      if (redirect.protocol !== "https:" || redirect.username || redirect.password ||
        !["connect.composio.dev", "backend.composio.dev"].includes(redirect.hostname)) return connectorProxyFailure(502, "INVALID_RESPONSE")
      setAttemptCookie(response, started.attempt_id, { site_id: siteId, user_id: user.id, nonce })
    }
    if (kind === "complete" && z.object({ status: z.literal("completed"), connector_id: z.string(), toolkit_slug: z.string() }).safeParse(payload).success) clearAttemptCookie(response, path[1])
    return response
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return connectorProxyFailure(413, "REQUEST_TOO_LARGE")
    if (error instanceof z.ZodError || error instanceof SyntaxError) return connectorProxyFailure(400, "INVALID_REQUEST")
    return connectorProxyFailure(503, "CONNECTORS_UNAVAILABLE")
  }
}