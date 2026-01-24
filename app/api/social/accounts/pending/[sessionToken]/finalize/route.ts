import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> }
) {
  try {
    const supabase = await createSocialSupabaseClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get sessionToken from params
    const { sessionToken } = await params

    // Parse request body - should contain selected account IDs
    const body = await request.json()
    const { accountIds } = body

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one account ID must be provided" },
        { status: 400 }
      )
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

    console.log(`[Social Auth] Finalizing connection for session: ${sessionToken}`, { accountIds })

    const response = await fetch(
      `${outstandApiUrl}/v1/social-accounts/pending/${sessionToken}/finalize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${outstandApiKey}`,
        },
        body: JSON.stringify({ accountIds }),
      }
    )

    console.log(`[Social Auth] Finalize API response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const responseText = await response.text()
      console.error(`[Social Auth] Finalize API error response (raw):`, responseText)
      
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch (e) {
        errorData = { error: responseText || "Unknown error", raw: responseText }
      }
      
      console.error(`[Social Auth] Finalize API error (parsed):`, errorData)
      return NextResponse.json(
        { success: false, error: errorData.error || errorData.message || "Failed to finalize connection", details: errorData },
        { status: response.status }
      )
    }

    const responseText = await response.text()
    console.log(`[Social Auth] Finalize API success response (raw):`, responseText)
    
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
    
    console.log(`[Social Auth] Finalize API response (parsed):`, JSON.stringify(data, null, 2))

    return NextResponse.json({
      success: true,
      data: data.data || data,
    })
  } catch (error) {
    console.error("Error in finalize API:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
