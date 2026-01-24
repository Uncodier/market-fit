import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"

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
    
    // Map platform names to outstand.so network types
    const networkMap: Record<string, string> = {
      'facebook': 'facebook',
      'twitter': 'x', // Twitter is now X
      'x': 'x',
      'instagram': 'instagram',
      'linkedin': 'linkedin',
      'youtube': 'youtube',
      'tiktok': 'tiktok',
      'pinterest': 'pinterest',
      'github': 'github',
      'reddit': 'reddit',
      'medium': 'medium',
      'whatsapp': 'whatsapp',
      'telegram': 'telegram',
      'discord': 'discord',
    }
    
    const outstandNetwork = networkMap[network.toLowerCase()]
    if (!outstandNetwork) {
      return NextResponse.json(
        { success: false, error: `Invalid network type: ${network}. Supported networks: ${Object.keys(networkMap).join(', ')}` },
        { status: 400 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    const { redirect_uri, tenant_id } = body

    // Get current site from query params or body
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get("siteId") || body.siteId

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: "Site ID is required" },
        { status: 400 }
      )
    }

    // Build request body for Outstand API.
    // redirect_uri: where Outstand will send the user after they get code from the provider.
    // (Facebook redirects to Outstand; Outstand then redirects to our redirect_uri with ?session= or ?error=.)
    // tenant_id: we use siteId to associate the connected account with our tenant.
    const outstandRequestBody: Record<string, unknown> = {}
    if (redirect_uri) {
      outstandRequestBody.redirect_uri = redirect_uri
      console.log(`[Social Auth] Using redirect_uri: ${redirect_uri}`)
    } else {
      console.log(`[Social Auth] No redirect_uri provided, Outstand will use default (2-leg)`)
    }
    if (tenant_id) {
      outstandRequestBody.tenant_id = tenant_id
      console.log(`[Social Auth] Using tenant_id: ${tenant_id}`)
    }

    // Call outstand.so API
    const outstandApiUrl = process.env.OUTSTAND_API_URL || "https://api.outstand.so"
    const outstandApiKey = process.env.OUTSTAND_API_KEY

    if (!outstandApiKey) {
      return NextResponse.json(
        { success: false, error: "Outstand API key not configured" },
        { status: 500 }
      )
    }

    console.log(`[Social Auth] Calling outstand.so API for network: ${outstandNetwork}`)
    console.log(`[Social Auth] Request body:`, JSON.stringify(outstandRequestBody, null, 2))

    const response = await fetch(
      `${outstandApiUrl}/v1/social-networks/${outstandNetwork}/auth-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${outstandApiKey}`,
        },
        body: JSON.stringify(outstandRequestBody),
      }
    )

    console.log(`[Social Auth] Outstand API response status: ${response.status} ${response.statusText}`)
    console.log(`[Social Auth] Outstand API response headers:`, Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const responseText = await response.text()
      console.error(`[Social Auth] Outstand API error response (raw):`, responseText)
      
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch (e) {
        errorData = { error: responseText || "Unknown error", raw: responseText }
      }
      
      console.error(`[Social Auth] Outstand API error (parsed):`, errorData)
      return NextResponse.json(
        { success: false, error: errorData.error || errorData.message || "Failed to get auth URL", details: errorData },
        { status: response.status }
      )
    }

    const responseText = await response.text()
    console.log(`[Social Auth] Outstand API success response (raw):`, responseText)
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error(`[Social Auth] Failed to parse response as JSON:`, e)
      return NextResponse.json(
        { success: false, error: "Invalid response format from outstand.so API" },
        { status: 500 }
      )
    }
    
    console.log(`[Social Auth] Outstand API response (parsed):`, JSON.stringify(data, null, 2))
    console.log(`[Social Auth] Auth URL:`, data.data?.auth_url)

    return NextResponse.json({
      success: true,
      data: {
        auth_url: data.data?.auth_url,
      },
    })
  } catch (error) {
    console.error("Error in social auth-url API:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
