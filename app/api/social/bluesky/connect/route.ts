import { NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { syncImplicitOutstandCallback } from "@/app/api/social/lib/sync-outstand-accounts"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"

export async function POST(request: Request) {
  try {
    const supabase = await createSocialSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { handle, app_password, siteId } = await request.json()

    if (!handle || !app_password || !siteId) {
      return NextResponse.json(
        { success: false, error: "Missing handle, app_password, or siteId" },
        { status: 400 }
      )
    }

    const res = await fetch(getOutstandIntegrationUrl("/social-accounts/bluesky"), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": process.env.SERVICE_API_KEY || ""
      },
      body: JSON.stringify({ handle, app_password, siteId }),
    })

    const text = await res.text()
    let data: any = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { error: text }
    }

    if (!res.ok || data.success === false) {
      return NextResponse.json(
        { success: false, error: data.error || data.message || "Failed to connect Bluesky account" },
        { status: res.status || 500 }
      )
    }

    const syncRes = await syncImplicitOutstandCallback({
      supabase,
      siteId,
      pathNetwork: "bluesky",
    })

    if (!syncRes.ok) {
      return NextResponse.json(
        { success: false, error: syncRes.message, connected: true },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data.data || data, sync: syncRes })
  } catch (error: any) {
    console.error("[Bluesky Connect] Internal error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
