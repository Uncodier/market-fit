import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    
    // Check if it's empty body (AppSumo ping)
    if (!bodyText) {
      return NextResponse.json({ event: 'ping', success: true }, { status: 200 })
    }

    let body
    try {
      body = JSON.parse(bodyText)
    } catch {
      // If we can't parse it, it might just be a ping or malformed
      return NextResponse.json({ event: 'ping', success: true }, { status: 200 })
    }

    // Log for debugging
    console.log("AppSumo Webhook received:", body)
    
    // Handle AppSumo's test webhook format
    if (body.test === true || body.event === 'test' || body.action === 'test') {
      return NextResponse.json({ 
        event: body.event || body.action || 'purchase', 
        success: true 
      }, { status: 200 })
    }

    const { action, plan_id, uuid, activation_email, invoice_item_uuid, event } = body
    
    // AppSumo sends the action inside 'action' (v1) or 'event' (v2)
    const eventAction = event || action

    // AppSumo needs us to return { success: true } for the validation to pass
    if (eventAction === 'activate') {
      // Validate or create the license
      const supabaseAdmin = await createServiceClient()
      
      // Upsert the license
      await supabaseAdmin.from('partner_licenses').upsert({
        license_key: uuid,
        partner: 'appsumo',
        status: 'active',
        plan_name: plan_id // we store the plan_id to identify Tier 1, Tier 2, etc.
      }, { onConflict: 'license_key' })

      return NextResponse.json({ event: 'activate', success: true }, { status: 200 })
    }

    if (eventAction === 'refund') {
      const supabaseAdmin = await createServiceClient()
      
      await supabaseAdmin.from('partner_licenses').update({
        status: 'refunded'
      }).eq('license_key', uuid)

      return NextResponse.json({ event: 'refund', success: true }, { status: 200 })
    }

    if (eventAction === 'upgrade' || eventAction === 'downgrade') {
      const supabaseAdmin = await createServiceClient()
      
      await supabaseAdmin.from('partner_licenses').update({
        plan_name: plan_id
      }).eq('license_key', uuid)

      return NextResponse.json({ event: eventAction, success: true }, { status: 200 })
    }

    // Default response for other actions (or validation ping)
    return NextResponse.json({ event: eventAction || 'ping', success: true }, { status: 200 })
  } catch (error) {
    console.error("AppSumo webhook error:", error)
    // Return success: false when there's a real error, but we should make sure we don't fail the AppSumo validation ping.
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Just in case AppSumo does a GET to validate the URL
  return NextResponse.json({ success: true, message: 'Ready' }, { status: 200 })
}
