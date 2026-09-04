import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
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

    const { accountId } = await params
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Account ID is required" },
        { status: 400 }
      )
    }

    const tenantId =
      request.nextUrl.searchParams.get("tenant_id") ||
      request.nextUrl.searchParams.get("siteId") ||
      ""

    const url = new URL(getOutstandIntegrationUrl(`/social-accounts/${encodeURIComponent(accountId)}`))
    if (tenantId) url.searchParams.set("tenant_id", tenantId)

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SERVICE_API_KEY || "",
      },
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying social account delete:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
