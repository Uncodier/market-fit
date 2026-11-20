import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { pendingAttemptIds, readAttemptCookie } from "../attempt-cookie"
import { proxyConnector } from "../proxy"

/** Attempt selection is explicit; never infer the most recent tab's OAuth identity. */
export async function GET(request: NextRequest) {
  const client = await createClient(true)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Please sign in again." } }, { status: 401 })
  const items: Array<{ attempt_id: string; site_id: string; toolkit_slug: string; status: string }> = []
  for (const id of pendingAttemptIds(request)) {
    const cookie = readAttemptCookie(request, id)
    if (!cookie || cookie.user_id !== user.id) continue
    const url = new URL(`/api/connectors/auth-attempts/${id}`, request.url)
    url.searchParams.set("site_id", cookie.site_id)
    const response = await proxyConnector(new NextRequest(url, { headers: request.headers }), ["auth-attempts", id])
    if (response.status === 401 || response.status === 503) return response
    if (!response.ok) continue
    const data = await response.json()
    if (data.user_id !== cookie.user_id) continue
    if (typeof data.toolkit_slug === "string" && data.status === "pending" &&
      typeof data.expires_at === "string" && Date.parse(data.expires_at) > Date.now()) {
      items.push({ attempt_id: id, site_id: cookie.site_id, toolkit_slug: data.toolkit_slug, status: data.status })
    }
  }
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } })
}