import "server-only"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { emergencyGraceDeniedSchema, emergencyGraceGrantSchema } from "@/lib/billing/emergency-grace"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { withTimeout } from "@/app/services/request-timeout"

const inputSchema = z.object({ site_id: z.string().uuid() }).strict()
const headers = { "Cache-Control": "private, no-store" }

function failure(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers })
}

const forbidden = () => failure("FORBIDDEN", "Only a workspace owner can request emergency access.", 403)
const unavailable = () => failure("GRACE_UNAVAILABLE", "Emergency workspace access could not be confirmed.", 503)

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("FORBIDDEN_ORIGIN", "Origin not allowed.", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure("INVALID_CONTENT_TYPE", "JSON content type required.", 415)
  }

  let siteId: string
  try {
    const body = await readLimitedRequestBody(request, 1_024)
    siteId = inputSchema.parse(JSON.parse(decodeRequestBody(body))).site_id
  } catch (error) {
    return failure("INVALID_REQUEST", "Invalid emergency access request.", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) {
      if (access.error.status === 401) return failure("UNAUTHORIZED", "Sign in to request emergency access.", 401)
      if (access.error.status === 403) return forbidden()
      return unavailable()
    }
    if (access.role !== "owner") return forbidden()

    const { data: site, error: siteError } = await withTimeout<{
      data: { user_id: string } | null; error: unknown
    }>(access.supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle(),
      4_000, "Workspace ownership could not be verified")
    if (siteError) return unavailable()
    if (!site || site.user_id !== access.userId) return forbidden()

    // The same user-scoped client carries the verified identity into the RPC. SQL
    // rechecks ownership and decides eligibility, timing and replay atomically.
    const { data, error } = await withTimeout<{ data: unknown; error: unknown }>(
      access.supabase.rpc("grant_emergency_grace", { p_business_id: siteId }),
      8_000, "Emergency access request timed out",
    )
    if (error) return unavailable()
    const grant = emergencyGraceGrantSchema.safeParse(data)
    if (grant.success) return Response.json(grant.data, { headers })

    const denial = emergencyGraceDeniedSchema.safeParse(data)
    if (denial.success) {
      switch (denial.data.outcome) {
        case "forbidden": return forbidden()
        case "ineligible": return failure("GRACE_INELIGIBLE", "This workspace is not eligible for emergency access this billing cycle.", 409)
        case "limit_reached": return failure("GRACE_LIMIT_REACHED", "This workspace has used its emergency access allowance for the last 12 months.", 409)
      }
    }
    return unavailable()
  } catch {
    return unavailable()
  }
}