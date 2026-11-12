import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { connectionResponseSchema, modelsResponseSchema, mutationSchema, setupResponseSchema } from "@/lib/integrations/openrouter-contract"
import { openRouterFeedback } from "@/lib/integrations/openrouter-feedback"

const headers = { "Cache-Control": "private, no-store" }
function failure(status: number, code?: keyof typeof openRouterFeedback) {
  const messages: Record<number, string> = {
    400: "Invalid OpenRouter configuration request.", 401: "Please sign in again.",
    403: "Only site owners and administrators can manage OpenRouter.",
    409: "Configuration changed. Reload before trying again.",
    413: "OpenRouter configuration request is too large.", 415: "JSON content type required.",
    422: "This configuration is not available. Check model compatibility and rollout status.",
    429: "Too many requests. Please try again later.",
    503: "OpenRouter integration is not available yet.",
  }
  return Response.json({ error: code ? openRouterFeedback[code] : messages[status] || "OpenRouter request could not be confirmed. Reload its status before retrying." }, {
    status, headers: { ...headers, ...(code ? { "X-OpenRouter-Error": code } : {}) },
  })
}

export async function proxyOpenRouter(request: Request, models: boolean | "setup" = false): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure(403)
  let body: z.infer<typeof mutationSchema> | undefined
  let siteId: string
  try {
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure(415)
      body = mutationSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 16_384))))
      siteId = body.siteId
    } else {
      const query = new URL(request.url).searchParams
      if (query.getAll("siteId").length !== 1 || [...query.keys()].some(key => key !== "siteId")) return failure(400)
      siteId = z.string().uuid().parse(query.get("siteId"))
    }
  } catch (error) {
    return failure(error instanceof RequestBodyTooLargeError ? 413 : 400)
  }
  try {
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    const { data: { session }, error } = await access.supabase.auth.getSession()
    if (error || !session?.access_token || session.user?.id !== access.userId) return failure(401)
    const target = configuredApiUrl(request, `/api/integrations/openrouter${models === "setup" ? "/setup" : models ? "/models" : ""}`)
    if (!target) return failure(503, "api_not_configured")
    if (!body) target.searchParams.set("siteId", siteId)
    let upstream: Response
    try {
      upstream = await fetch(target, {
        method: body ? "POST" : "GET", cache: "no-store", redirect: "error",
        headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json", "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(body?.operation === "verify" ? 220_000 : 25_000)]),
      })
    } catch {
      return failure(502, "api_unavailable")
    }
    if (!upstream.ok) {
      await upstream.body?.cancel()
      return failure([400, 401, 403, 409, 422, 429, 503].includes(upstream.status) ? upstream.status : 502)
    }
    try {
      const payload: unknown = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, models ? 4_000_000 : 64_000)))
      if (models === "setup") return Response.json(setupResponseSchema.parse(payload), { headers })
      if (models) return Response.json(modelsResponseSchema.parse(payload), { headers })
      const data = connectionResponseSchema.parse(payload)
      if (data.connection && data.connection.siteId !== siteId) return failure(502)
      return Response.json(data, { headers })
    } catch {
      return failure(502, "invalid_response")
    }
  } catch {
    return failure(502)
  }
}