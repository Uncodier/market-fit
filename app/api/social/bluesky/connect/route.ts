import { NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { syncImplicitOutstandCallback } from "@/app/api/social/lib/sync-outstand-accounts"

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

    // Call Outstand API
    const outstandApiUrl = process.env.OUTSTAND_API_URL || "https://api.outstand.so"
    const outstandApiKey = process.env.OUTSTAND_API_KEY

    if (!outstandApiKey) {
      return NextResponse.json(
        { success: false, error: "Outstand API key not configured" },
        { status: 500 }
      )
    }

    console.log(`[Bluesky Connect] Initiating connection for handle: ${handle}`)

    const res = await fetch(`${outstandApiUrl}/v1/social-accounts/bluesky`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${outstandApiKey}`,
        "X-Tenant-ID": siteId,
      },
      body: JSON.stringify({ handle, app_password }),
    })

    const text = await res.text()
    if (!res.ok) {
      console.error("[Bluesky Connect] Outstand API error:", text)
      let errMsg = "Failed to connect Bluesky account"
      try {
        const j = JSON.parse(text)
        errMsg = j.error || j.message || errMsg
      } catch (e) {
        errMsg = text || errMsg
      }
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: res.status }
      )
    }

    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      data = { text }
    }

    console.log(`[Bluesky Connect] Outstand returned success. Syncing accounts...`)

    // Now sync the accounts into settings.social_media
    const syncRes = await syncImplicitOutstandCallback({
      supabase,
      siteId,
      pathNetwork: "bluesky",
    })

    if (!syncRes.ok) {
      console.error("[Bluesky Connect] Sync error:", syncRes.message)
      // Even if sync failed, the connection on Outstand worked, but let's report the error
      return NextResponse.json(
        { success: false, error: syncRes.message, connected: true },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data, sync: syncRes })
  } catch (error: any) {
    console.error("[Bluesky Connect] Internal error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
