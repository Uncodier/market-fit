import { NextRequest, NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BYTES = 150_000

type SkillAction = "catalog" | "system" | "item" | "external" | "preview" | "import"

export async function proxySkills(request: NextRequest, action: SkillAction, id?: string): Promise<Response> {
  const method = request.method
  if (action === "item" && (!id || !UUID.test(id))) {
    return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 })
  }
  let body: Record<string, unknown> = {}
  if (method !== "GET") {
    try {
      const parsed: unknown = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, MAX_BYTES)))
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body")
      body = parsed as Record<string, unknown>
    } catch (error) {
      return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? error.message : "Invalid JSON body" }, {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
      })
    }
  }
  const siteId = method === "GET" ? request.nextUrl.searchParams.get("site_id") : body.site_id
  if (typeof siteId !== "string" || !UUID.test(siteId)) {
    return NextResponse.json({ error: "Invalid site_id" }, { status: 400 })
  }
  const access = await requireSiteAccess(request, siteId, { requireManager: method !== "GET" })
  if (access.error) return access.error

  const query = request.nextUrl.searchParams.get("query") ?? ""
  if (action === "external" && query.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 })
  }
  if ((action === "catalog" && method === "POST") || (action === "item" && method === "PATCH" && body.content !== undefined)) {
    if (typeof body.content !== "string" || !body.content.trim() || body.content.length > 131_072) {
      return NextResponse.json({ error: "Invalid skill content" }, { status: 400 })
    }
  }
  if (action === "item" && method === "PATCH" &&
    ((body.content === undefined && typeof body.enabled !== "boolean") ||
      (body.enabled !== undefined && typeof body.enabled !== "boolean"))) {
    return NextResponse.json({ error: "Invalid skill update" }, { status: 400 })
  }
  if ((action === "preview" || action === "import") &&
    (typeof body.url !== "string" || body.url.length > 2048 || !/^https:\/\//i.test(body.url))) {
    return NextResponse.json({ error: "A valid HTTPS URL is required" }, { status: 400 })
  }

  if (action === "import" && (typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.sha256))) {
    return NextResponse.json({ error: "Preview the skill before importing" }, { status: 400 })
  }

  const apiKey = process.env.SERVICE_API_KEY?.trim()
  const rawUrl = (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL || "").trim()
  if (!rawUrl || ((method === "GET" || action === "preview") && !apiKey)) {
    return NextResponse.json({ error: "Skills API is not configured" }, { status: 503 })
  }
  const apiUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(rawUrl) ? "http" : "https"}://${rawUrl}`
  let target: URL
  try {
    const base = new URL(apiUrl)
    if (!(["https:", "http:"].includes(base.protocol)) || base.username || base.password ||
      (base.protocol === "http:" && !["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("Invalid API URL")
    target = new URL(`/api/skills${action === "item" ? `/${id}` : action === "catalog" ? "" :
      action === "system" ? "/system" : action === "external" ? "/external" : `/external/${action}`}`, base)
    if (target.origin === request.nextUrl.origin) throw new Error("API URL points to the web app")
  } catch {
    return NextResponse.json({ error: "Skills API is misconfigured" }, { status: 503 })
  }
  if (method === "GET") {
    target.searchParams.set("site_id", siteId)
    if (action === "external") target.searchParams.set("query", query)
  }
  if (action === "item" && method === "DELETE") target.searchParams.set("site_id", siteId)
  let authorization: string | undefined
  if (method !== "GET" && action !== "preview") {
    const { data: { session }, error } = await access.supabase.auth.getSession()
    if (error || !session?.access_token || session.user?.id !== access.userId) {
      return NextResponse.json({ error: "Session unavailable" }, { status: 401 })
    }
    authorization = `Bearer ${session.access_token}`
  }
  try {
    const response = await fetch(target, {
      method,
      headers: { ...(authorization ? { authorization } : { "x-api-key": apiKey! }), "content-type": "application/json" },
      ...(method !== "GET" && method !== "DELETE" ? { body: JSON.stringify(action === "preview" || action === "import" ? { site_id: siteId, url: body.url, ...(action === "import" ? { sha256: body.sha256 } : {}) }
          : { site_id: siteId, ...(body.content !== undefined ? { content: body.content } : {}),
            ...(action === "item" && body.enabled !== undefined ? { enabled: body.enabled } : {}) }) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json", "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json({ error: "Skills API unavailable" }, { status: 502 })
  }
}