import { z } from "zod"
import { requireUnrestrictedLocationAccess } from "@/lib/auth/location-boundary.server"
import { getCurrentUserSiteRole, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { listCancellationPlans } from "./list-plans"

export const GET = listCancellationPlans

const inputSchema = z.object({ plan_id: z.string().uuid(), instance_id: z.string().uuid() }).strict()
const receiptSchema = inputSchema.extend({ status: z.literal("cancelled"), steps_cancelled: z.number().int().nonnegative() })
const headers = { "Cache-Control": "no-store, private" }
function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, { status, headers })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("JSON content type required", 415)
  }
  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096))))
  } catch (error) {
    return failure("Provide valid plan and instance IDs", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }
  try {
    const access = await requireUnrestrictedLocationAccess()
    if (access.error) return access.error
    const { supabase } = access
    const { data: plan, error: readError } = await supabase.from("instance_plans")
      .select("id, instance_id, site_id").eq("id", input.plan_id).eq("instance_id", input.instance_id).maybeSingle()
    if (readError) return failure("Plan access could not be verified", 503)
    if (!plan || plan.id !== input.plan_id || plan.instance_id !== input.instance_id) return failure("Plan not found", 404)
    const role = await getCurrentUserSiteRole(supabase, plan.site_id)
    if (!isSiteManagerRole(role) || !await userCanOnSite(supabase, plan.site_id, "update")) {
      return failure("Only project owners and admins can cancel plans", 403)
    }
    const { data, error } = await supabase.rpc("cancel_quiescent_instance_plan", {
      p_plan_id: input.plan_id, p_instance_id: input.instance_id,
    })
    if (error) {
      const code = error.code
      if (code === "PT401") return failure("Please sign in again", 401)
      if (["PT403", "42501"].includes(code)) return failure("Permission denied", 403)
      if (code === "PT404") return failure("Plan not found", 404)
      if (["PT409", "23514"].includes(code)) return failure("Stop and reconcile active execution before cancelling this plan. No plan changes were committed.", 409)
      if (["PGRST202", "42883", "42P01", "42703"].includes(code)) return failure("Plan cancellation requires the database migration", 503)
      return failure("Plan cancellation could not be confirmed. Refresh before trying again.", 503)
    }
    const result = receiptSchema.safeParse(data)
    if (!result.success || result.data.plan_id !== input.plan_id || result.data.instance_id !== input.instance_id) {
      return failure("Plan cancellation could not be confirmed. Refresh before trying again.", 502)
    }
    return Response.json({ success: true, data: result.data }, { headers })
  } catch {
    return failure("Plan cancellation could not be confirmed. Refresh before trying again.", 502)
  }
}