import { z } from "zod"
import { resolveSelfServiceBuyer, resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { verifyBuyerIdentityToken } from "@/app/commerce/buyer-identity-token"
import { createServiceClient } from "@/lib/supabase/server"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { checkRateLimit, hashRedisKeyPart, rateLimitError } from "@/lib/redis/control-plane"
import { trustedVisitorBrowserOrigin, visitorSessionPreflight, withVisitorSessionCors } from "../visitor-session/browser-origin"

const inputSchema = z.object({ code: z.string().min(1).max(1024), locationId: z.string().uuid() }).strict()
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" }

export function OPTIONS(request: Request) { return visitorSessionPreflight(request) }

export async function POST(request: Request) {
  if (!trustedVisitorBrowserOrigin(request)) return Response.json({ error: "Origin not allowed." }, { status: 403, headers })
  return withVisitorSessionCors(request, await identifyBuyer(request))
}

async function identifyBuyer(request: Request): Promise<Response> {
  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 2048))))
  } catch (error) {
    return Response.json({ error: "Invalid account QR request." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers })
  }
  try {
    // A signed bearer proof authorizes identification, not account or order-history access.
    if (!verifyBuyerIdentityToken(input.code)) return Response.json({ error: "Invalid or expired account QR." }, { status: 400, headers })
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
    const limit = await checkRateLimit(`rl:v1:buyer-identity:${await hashRedisKeyPart(ip)}`, { limit: 30, windowSeconds: 60, failureMode: "closed" })
    if (!limit.allowed) return rateLimitError(limit)
    const supabase = await createServiceClient(true, { access: "public" })
    const context = await resolveSelfServiceLocation(input.locationId, supabase)
    if (!context) return Response.json({ error: "Self-service location unavailable." }, { status: 404, headers })
    const buyer = await resolveSelfServiceBuyer(input.code, supabase)
    return Response.json({ name: buyer.name }, { headers })
  } catch {
    return Response.json({ error: "Unable to identify this account. Refresh your QR or continue anonymously." }, { status: 400, headers })
  }
}