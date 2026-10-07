import "server-only"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

const inputSchema = z.object({ site_id: z.string().uuid() }).strict()
const resultSchema = z.object({
  success: z.literal(true),
  outcome: z.enum(["initialized", "already_initialized"]),
  billing_id: z.string().uuid(),
  credits_granted: z.number().finite().nonnegative(),
  credits_available: z.number().finite().nonnegative(),
})
const headers = { "Cache-Control": "no-store, private" }

function failure(code: string, message: string, status: number) {
  return Response.json({ success: false, error: { code, message } }, { status, headers })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("FORBIDDEN_ORIGIN", "Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("INVALID_CONTENT_TYPE", "JSON content type required", 415)
  }

  let siteId: string
  try {
    const body = decodeRequestBody(await readLimitedRequestBody(request, 4_096))
    siteId = inputSchema.parse(JSON.parse(body)).site_id
  } catch (error) {
    return failure("INVALID_REQUEST", "Invalid billing initialization request", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    if (!await userCanOnSite(access.supabase, siteId, "update")) {
      return failure("FORBIDDEN", "Billing initialization requires project management permission", 403)
    }

    // The database owns the atomic, idempotent initial grant. Never write balances here.
    const service = await createServiceClient(true)
    const { data, error } = await service.rpc("initialize_site_billing", { p_site_id: siteId })
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        return failure("BILLING_INITIALIZATION_UNAVAILABLE", "Billing initialization is unavailable. Your project is saved; retry billing setup later or contact support.", 503)
      }
      return failure("BILLING_INITIALIZATION_FAILED", "Billing initialization could not be confirmed. Your project is saved; retry billing setup.", 503)
    }
    const result = resultSchema.safeParse(data)
    if (!result.success) {
      return failure("BILLING_INITIALIZATION_FAILED", "Billing initialization could not be confirmed. Your project is saved; retry billing setup.", 503)
    }
    // Do not return database payloads, private errors, or unverified balance promises.
    return Response.json({ success: true, outcome: result.data.outcome }, { headers })
  } catch {
    return failure("BILLING_INITIALIZATION_FAILED", "Billing initialization could not be confirmed. Your project is saved; retry billing setup.", 503)
  }
}