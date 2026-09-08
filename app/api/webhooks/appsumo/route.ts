import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"

// Validate HMAC SHA256 signature
function isValidSignature(
  signature: string | null,
  timestamp: string | null,
  rawBody: string,
  secret: string
) {
  if (!signature || !timestamp || !secret) return false

  const data = timestamp + rawBody
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex")

  return signature === expectedSignature
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-appsumo-signature")
    const timestamp = req.headers.get("x-appsumo-timestamp")
    const secret = process.env.APPSUMO_API_KEY || ""

    // We need the raw body for HMAC validation
    const rawBody = await req.text()
    
    // In production we should validate this signature strictly
    if (process.env.NODE_ENV === "production" && !isValidSignature(signature, timestamp, rawBody, secret)) {
      console.warn("Invalid AppSumo webhook signature")
      // Still returning 200 is sometimes required by AppSumo to not block their queue, 
      // but usually we can return 403. Returning 200 with success: false.
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 403 })
    }

    const payload = JSON.parse(rawBody)
    const event = payload.event
    
    // Always return 200 for test webhooks
    if (payload.test) {
      return NextResponse.json({ event, success: true }, { status: 200 })
    }

    const supabase = await createServiceClient()
    
    const { 
      license_key, 
      parent_license_key, 
      plan_id,
      partner_plan_name,
      status: license_status 
    } = payload
    
    const planName = plan_id || partner_plan_name || 'unknown'
    
    // AppSumo sends various events: purchase, activate, upgrade, downgrade, migrate, deactivate
    
    if (event === "purchase" || event === "activate" || event === "upgrade" || event === "downgrade" || event === "migrate" || event === "deactivate") {
      
      const { error } = await supabase
        .from('partner_licenses')
        .upsert({
          license_key,
          parent_license_key: parent_license_key || null,
          partner: 'appsumo',
          status: license_status,
          plan_name: planName, 
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'license_key'
        })
        
      if (error) {
        console.error("Error upserting AppSumo license:", error)
        // Even on error, we should return 200 to AppSumo so they don't retry endlessly, 
        // but here we can just log it.
      }
    }

    // Must return 200 OK and { event, success: true }
    return NextResponse.json({ event, success: true }, { status: 200 })
    
  } catch (error) {
    console.error("Error processing AppSumo webhook:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
