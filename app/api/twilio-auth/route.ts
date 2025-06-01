import { NextRequest, NextResponse } from "next/server"

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const NEXT_PUBLIC_API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("Missing Twilio credentials in environment variables")
      return NextResponse.json(
        { error: "Twilio credentials not configured" },
        { status: 500 }
      )
    }

    if (!NEXT_PUBLIC_API_SERVER_URL) {
      console.error("Missing NEXT_PUBLIC_API_SERVER_URL in environment variables")
      return NextResponse.json(
        { error: "API server URL not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { siteId, siteName } = body

    if (!siteId || !siteName) {
      return NextResponse.json(
        { error: "Site ID and Site Name are required" },
        { status: 400 }
      )
    }

    // For WhatsApp Business setup, we'll create a setup token that can be used
    // to configure webhooks and track the authorization process
    const setupToken = `whatsapp_setup_${siteId}_${Date.now()}`
    
    // Store the setup information temporarily (in a real app, you'd store this in a database)
    // For now, we'll return the necessary information for the frontend to handle the Facebook OAuth flow
    
    console.log("WhatsApp setup token created:", {
      token: setupToken,
      siteId,
      siteName
    })

    return NextResponse.json({
      success: true,
      data: {
        token: setupToken,
        setupUrl: "https://business.facebook.com/whatsapp/embedded-signup",
        webhookUrl: `${NEXT_PUBLIC_API_SERVER_URL}/api/agents/whatsapp`,
        siteId,
        siteName,
        instructions: "Use Facebook's WhatsApp Embedded Signup to authorize your business number"
      }
    })

  } catch (error) {
    console.error("Error creating WhatsApp setup token:", error)
    
    return NextResponse.json(
      { error: "Failed to create authorization token" },
      { status: 500 }
    )
  }
} 