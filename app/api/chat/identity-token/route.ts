import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiServerUrl } from "@/lib/api-server-url"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"

export const runtime = "nodejs"

const inputSchema = z.object({ session_id: z.string().uuid() }).strict()
const tokenSchema = z.object({
  success: z.literal(true),
  data: z.object({
    identity_token: z.string().min(1).max(8192),
    expires_at: z.string().datetime(),
  }),
})

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie, Origin" },
  })
}

function error(message: string, status: number) {
  return json({ success: false, error: { message } }, status)
}

function isTrustedBrowserRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false
  const allowed = [
    "https://app.makinari.com",
    "https://www.makinari.com",
    process.env.NEXT_PUBLIC_APP_URL,
  ]
  return allowed.some((value) => {
    if (!value) return false
    try {
      const url = new URL(value)
      return !url.username && !url.password && url.origin === origin
    } catch {
      return false
    }
  })
}

function issuerUrl(): string | null {
  try {
    const url = new URL(getApiServerUrl())
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (url.username || url.password || url.search || url.hash) return null
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production")) return null
    // The fetch destination is deployment configuration, never browser input.
    return new URL("/api/visitors/identity/token/current-user", url).toString()
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!isTrustedBrowserRequest(request)) return error("Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return error("JSON content type required", 415)
  }
  const sessionToken = request.headers.get("x-visitor-session-token")
  if (!sessionToken || sessionToken.length > 8192) return error("Widget session required", 400)
  if (!request.headers.get("cookie")) return error("Authentication required", 401)

  try {
    let input: z.infer<typeof inputSchema>
    try {
      input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 1024))))
    } catch (cause) {
      if (cause instanceof RequestBodyTooLargeError) throw cause
      return error("Invalid identity request", 400)
    }

    // Bypass demo mode. getSession is only used after a server-validated user.
    const supabase = await createClient(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || user.is_anonymous) return error("Authentication required", 401)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token || session.user.id !== user.id) {
      return error("Authentication required", 401)
    }
    const url = issuerUrl()
    if (!url) return error("Chat identity is unavailable", 503)

    // The API validates this bearer again and derives the stable user itself.
    // No service-role credential, profile email, site ID or user ID is forwarded.
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "x-visitor-session-token": sessionToken,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      const status = [400, 401, 403, 409, 429, 503].includes(upstream.status) ? upstream.status : 502
      return error("Chat identity could not be issued", status)
    }
    // Bound the response as well, and return only the public credential DTO.
    const bytes = await readLimitedRequestBody(upstream as unknown as Request, 16_384)
    const payload = tokenSchema.safeParse(JSON.parse(decodeRequestBody(bytes)))
    if (!payload.success) return error("Invalid chat identity response", 502)
    return json({ success: true, data: { ...payload.data.data, user_id: user.id } })
  } catch (cause) {
    if (cause instanceof RequestBodyTooLargeError && cause.maxBytes === 1024) {
      return error("Request body too large", 413)
    }
    // Do not log provider payloads, session credentials, or identity tokens.
    return error("Chat identity is unavailable", 503)
  }
}