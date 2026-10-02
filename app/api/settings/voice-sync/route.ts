import { after } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

export const maxDuration = 300

const inputSchema = z.object({ siteId: z.string().uuid() }).strict()
const responseHeaders = { "Cache-Control": "no-store, private" }

function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, { status, headers: responseHeaders })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("JSON content type required", 415)
  }

  let siteId: string
  try {
    const body = decodeRequestBody(await readLimitedRequestBody(request, 4_096))
    siteId = inputSchema.parse(JSON.parse(body)).siteId
  } catch (error) {
    return failure("Invalid voice synchronization request", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  const access = await requireSiteAccess(request, siteId)
  if (access.error) return access.error
  if (!await userCanOnSite(access.supabase, siteId, "update")) {
    return failure("Voice synchronization is not permitted", 403)
  }
  const { data: { session }, error } = await access.supabase.auth.getSession()
  if (error || !session?.access_token || session.user?.id !== access.userId) {
    return failure("Please sign in again to synchronize this site", 401)
  }
  const target = configuredApiUrl(request, "/api/integrations/zavu/voice")
  if (!target) return failure("Voice synchronization API is not configured", 503)

  // Own the request on the server so navigating away does not cancel the sync.
  // This is best-effort post-response work, not a durable job or a completed sync.
  after(async () => {
    try {
      const response = await fetch(target, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ siteId }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(240_000),
      })
      if (!response.ok) {
        console.error("Voice agent background synchronization failed", { siteId, status: response.status })
      }
      await response.body?.cancel()
    } catch {
      // Do not log upstream payloads, tokens, or retry an ambiguous execution.
      console.error("Voice agent background synchronization could not be confirmed", { siteId })
    }
  })

  return Response.json({ success: true, status: "accepted" }, { status: 202, headers: responseHeaders })
}