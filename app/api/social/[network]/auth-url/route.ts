import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> }
) {
  try {
    const supabase = await createSocialSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { network } = await params
    const body = await request.json().catch(() => ({}))
    const siteId = request.nextUrl.searchParams.get("siteId") || body.siteId || body.tenant_id

    const response = await fetch(
      `${getOutstandIntegrationUrl(`/social-networks/${network}/auth-url`)}?siteId=${encodeURIComponent(siteId || "")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying social auth-url:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
