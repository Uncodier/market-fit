import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { readUpstreamFailure } from "./upstream-failure"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"

export const maxDuration = 600

const inputSchema = z.object({
  instance_id: z.string().uuid(),
  delete_requirements: z.literal(true),
}).strict()
const resultSchema = z.object({
  success: z.literal(true),
  instance_id: z.string().uuid(),
  deleted_requirement_ids: z.array(z.string().uuid()).max(1_000),
})
const headers = { "Cache-Control": "no-store, private" }
const unconfirmed = "Deletion could not be confirmed. Refresh the instance list before trying again."

function failure(message: string, status: number, code?: string) {
  return Response.json({ success: false, error: { message, ...(code ? { code } : {}) } }, { status, headers })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("JSON content type required", 415)
  }

  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4_096))))
  } catch (error) {
    return failure("Confirm deletion of the instance and its associated requirements.",
      error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.is_anonymous) return failure("Unauthorized", 401)

    const { data: instance, error: fetchError } = await supabase.from("remote_instances")
      .select("id, site_id").eq("id", input.instance_id).maybeSingle()
    if (fetchError) return failure("Unable to verify instance access", 503)
    if (!instance || instance.id !== input.instance_id) return failure("Instance not found", 404)
    const role = await getCurrentUserSiteRole(supabase, instance.site_id)
    if (!isSiteManagerRole(role) || !await userCanOnSite(supabase, instance.site_id, "delete")) {
      return failure("Only project owners and admins can delete instances and their requirements.", 403)
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token || session.user?.id !== user.id) {
      return failure("Please sign in again to delete this instance.", 401)
    }
    const target = configuredApiUrl(request, "/api/robots/instance/delete")
    if (!target) return failure("Instance deletion API is not configured", 503)

    // The API owns provider shutdown and the atomic database deletion. Never
    // fall back to deleting logs, plans, or the parent row independently here.
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(580_000)]),
    })
    if (!upstream.ok) {
      const known = await readUpstreamFailure(upstream)
      console.error("[instance/delete proxy] Upstream failure", {
        upstream_status: upstream.status, upstream_code: known?.code ?? null,
      })
      const status = [400, 401, 403, 404, 409, 429, 503].includes(upstream.status) ? upstream.status : 502
      const message = status === 409
        ? "Deletion was blocked by linked requirements or active execution. No database cleanup was committed. Stop active work and check requirement ownership before retrying."
        : status === 503 ? "Instance deletion is unavailable. Check the API and required database migration."
          : status === 403 ? "You do not have permission to delete this instance and its requirements."
            : status === 401 ? "Please sign in again to delete this instance." : unconfirmed
      return failure(known?.message ?? message, status, known?.code)
    }
    if (!upstream.headers.get("content-type")?.includes("application/json")) {
      await upstream.body?.cancel()
      return failure(unconfirmed, 502)
    }
    const raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 64_000)))
    const result = resultSchema.safeParse(raw)
    if (!result.success || result.data.instance_id !== input.instance_id) return failure(unconfirmed, 502)
    return Response.json(result.data, { headers })
  } catch {
    // A lost response may follow a commit. Do not automatically replay deletion.
    return failure(unconfirmed, 502)
  }
}
