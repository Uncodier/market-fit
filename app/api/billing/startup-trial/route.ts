import "server-only"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { startupTrialSchema } from "@/lib/billing/startup-trial"
import { withTimeout } from "@/app/services/request-timeout"

const inputSchema = z.object({ site_id: z.string().uuid() }).strict()
const outcomeSchema = z.enum(["started", "already_started"])
const headers = { "Cache-Control": "no-store, private" }

function failure(code: string, message: string, status: number) {
  return Response.json({ success: false, error: { code, message } }, { status, headers })
}

async function trialOperation(request: Request, siteId: string, activate: boolean): Promise<Response> {
  try {
    const access = await requireSiteAccess(request, siteId, activate ? { requireManager: true } : {})
    if (access.error) return access.error
    if (activate && !await userCanOnSite(access.supabase, siteId, "update")) {
      return failure("FORBIDDEN", "Starting a trial requires project management permission", 403)
    }
    // Elevated access follows tenant authorization; SQL rechecks the trusted actor on activation.
    const service = await createServiceClient(true)
    const { data, error } = await withTimeout<{
      data: unknown; error: { code?: string } | null
    }>(activate
      ? service.rpc("start_site_startup_trial", { p_site_id: siteId, p_actor_id: access.userId })
      : service.rpc("get_site_startup_trial", { p_site_id: siteId }),
    8_000, "Trial status could not be confirmed")
    if (error) {
      if (error.code === "42501") return failure("FORBIDDEN", "Trial operation is not permitted", 403)
      if (error.code === "P0001") return failure("TRIAL_NOT_ELIGIBLE", "This project or its owner is not eligible for another Startup trial", 409)
      return failure("TRIAL_UNAVAILABLE", "Startup trials are unavailable. Retry later or contact support.", 503)
    }
    const outcomeValue = data && typeof data === "object" && "outcome" in data ? data.outcome : undefined
    if (activate && ["not_eligible", "already_used"].includes(String(outcomeValue))) {
      return failure("TRIAL_NOT_ELIGIBLE", "This project or its owner is not eligible for another Startup trial", 409)
    }
    const result = startupTrialSchema.safeParse(data)
    if (!result.success) return failure("TRIAL_UNAVAILABLE", "Trial status could not be confirmed. Retry loading Billing.", 503)
    if (activate) {
      const outcome = outcomeSchema.safeParse(outcomeValue)
      if (!outcome.success || (outcome.data === "started" && result.data.state !== "active")) {
        return failure("TRIAL_UNAVAILABLE", "Trial activation could not be confirmed. Retry loading Billing before trying again.", 503)
      }
      return Response.json({ ...result.data, outcome: outcome.data }, { headers })
    }
    return Response.json(result.data, { headers })
  } catch {
    return failure("TRIAL_UNAVAILABLE", "Trial status could not be confirmed. Retry loading Billing before trying again.", 503)
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("FORBIDDEN_ORIGIN", "Origin not allowed", 403)
  const query = new URL(request.url).searchParams
  const input = inputSchema.safeParse(Object.fromEntries(query))
  if (!input.success || query.getAll("site_id").length !== 1) {
    return failure("INVALID_REQUEST", "A valid project ID is required", 400)
  }
  return trialOperation(request, input.data.site_id, false)
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("FORBIDDEN_ORIGIN", "Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("INVALID_CONTENT_TYPE", "JSON content type required", 415)
  }
  let siteId: string
  try {
    siteId = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4_096)))).site_id
  } catch (error) {
    return failure("INVALID_REQUEST", "Invalid trial activation request", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }
  return trialOperation(request, siteId, true)
}