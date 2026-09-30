import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { configuredApiUrl, isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import { CONTENT_GENERATION_UNCONFIRMED, contentGenerationResultSchema } from "./contract"

export const maxDuration = 120

const uuid = z.string().uuid()
const preference = z.string().trim().max(20_000).optional()
const inputSchema = z.object({
  contentId: uuid,
  siteId: uuid,
  segmentId: uuid.optional(),
  campaignId: uuid.optional(),
  quickAction: z.enum(["improve", "expand", "style", "summarize"]).optional(),
  styleControls: z.object({
    tone: z.enum(["formal", "neutral", "friendly"]).optional(),
    complexity: z.enum(["simple", "moderate", "advanced"]).optional(),
    creativity: z.enum(["factual", "balanced", "creative"]).optional(),
    persuasiveness: z.enum(["informative", "balanced", "persuasive"]).optional(),
    targetAudience: z.enum(["mixed", "specific"]).optional(),
    engagement: z.enum(["professional", "balanced", "engaging"]).optional(),
    size: z.enum(["short", "medium", "long"]).optional(),
  }).optional(),
  whatImGoodAt: preference,
  topicsImInterestedIn: preference,
  topicsToAvoid: preference,
  aiPrompt: preference,
})
const contentSchema = z.object({
  id: uuid, site_id: uuid, segment_id: uuid.nullable(), campaign_id: uuid.nullable(),
})
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
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 128_000))))
  } catch (error) {
    return failure("Invalid content generation request", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    const access = await requireSiteAccess(request, input.siteId)
    if (access.error) return access.error
    if (!await userCanOnSite(access.supabase, input.siteId, "update")) {
      return failure("You do not have permission to edit content in this site.", 403)
    }

    const { data: row, error: contentError } = await access.supabase
      .from("content").select("id, site_id, segment_id, campaign_id")
      .eq("id", input.contentId).eq("site_id", input.siteId).maybeSingle()
    if (contentError) return failure("Unable to verify content access", 503)
    if (!row) return failure("Content not found", 404)
    const parsedContent = contentSchema.safeParse(row)
    if (!parsedContent.success) return failure("Unable to verify content access", 503)
    const content = parsedContent.data
    if (content.id !== input.contentId || content.site_id !== input.siteId) {
      return failure("Content not found", 404)
    }

    // The API falls back to stored relations when overrides are omitted. Validate
    // both saved and requested context with the signed-in user's RLS client.
    const relations = [
      { table: "segments", savedId: content.segment_id, requestedId: input.segmentId },
      { table: "campaigns", savedId: content.campaign_id, requestedId: input.campaignId },
    ] as const
    for (const relation of relations) {
      for (const id of new Set([relation.savedId, relation.requestedId].filter(Boolean))) {
        const { data, error } = await access.supabase.from(relation.table).select("id")
          .eq("id", id).eq("site_id", content.site_id).maybeSingle()
        if (error) return failure("Unable to verify content context", 503)
        if (!data || data.id !== id) return failure("Content context not found in this site", 404)
      }
    }

    const { data: { session }, error: sessionError } = await access.supabase.auth.getSession()
    if (sessionError || !session?.access_token || session.user?.id !== access.userId) {
      return failure("Please sign in again to generate content.", 401)
    }
    const target = configuredApiUrl(request, "/api/agents/copywriter/content-editor")
    if (!target) return failure("Content generation API is not configured", 503)

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...input,
        contentId: content.id,
        siteId: content.site_id,
        userId: access.userId,
        segmentId: input.segmentId || content.segment_id || undefined,
        campaignId: input.campaignId || content.campaign_id || undefined,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      const status = [400, 401, 403, 404, 409, 429, 500, 503].includes(upstream.status) ? upstream.status : 502
      return failure(status === 401 ? "Please sign in again to generate content."
        : status === 403 ? "You do not have permission to generate this content." : CONTENT_GENERATION_UNCONFIRMED, status)
    }
    if (!upstream.headers.get("content-type")?.includes("application/json")) {
      await upstream.body?.cancel()
      return failure(CONTENT_GENERATION_UNCONFIRMED, 502)
    }
    const raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 1_000_000)))
    const result = contentGenerationResultSchema.safeParse(raw)
    if (!result.success || result.data.data.contentId !== content.id || result.data.data.siteId !== content.site_id) {
      return failure(CONTENT_GENERATION_UNCONFIRMED, 502)
    }
    return Response.json(result.data, { headers })
  } catch {
    // Never replay: a lost response can follow a successful database update.
    return failure(CONTENT_GENERATION_UNCONFIRMED, 502)
  }
}