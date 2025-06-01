import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log("WhatsApp webhook received:", body)
    
    // Extract relevant information from Twilio webhook
    const {
      AccountSid,
      From,
      To,
      Body,
      MessageSid,
      // Compliance/authorization specific fields
      ComplianceStatus,
      PhoneNumber,
      metadata
    } = body

    // Parse metadata if it exists
    let siteInfo = null
    try {
      if (metadata) {
        siteInfo = JSON.parse(metadata)
      }
    } catch (parseError) {
      console.warn("Could not parse metadata:", parseError)
    }

    // Handle different types of webhooks
    if (ComplianceStatus) {
      // This is a compliance/authorization status update
      console.log("Compliance status update:", {
        status: ComplianceStatus,
        phoneNumber: PhoneNumber,
        siteInfo
      })

      if (ComplianceStatus === 'approved' && siteInfo?.siteId) {
        // Update the site settings to mark WhatsApp as connected
        const supabase = createClient()
        
        const { error: updateError } = await supabase
          .from('settings')
          .upsert({
            site_id: siteInfo.siteId,
            whatsapp: {
              enabled: true,
              setupType: "port_existing",
              existingNumber: PhoneNumber,
              setupRequested: true,
              status: "connected"
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'site_id',
            ignoreDuplicates: false
          })

        if (updateError) {
          console.error("Error updating site settings:", updateError)
        } else {
          console.log("Successfully updated site settings for WhatsApp connection")
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: "Compliance status processed" 
      })
    }

    // Handle incoming WhatsApp messages
    if (From && Body) {
      console.log("Incoming WhatsApp message:", {
        from: From,
        to: To,
        body: Body,
        messageSid: MessageSid
      })

      // Here you can implement your WhatsApp message processing logic
      // For now, we'll just log it and return success
      
      return NextResponse.json({ 
        success: true, 
        message: "WhatsApp message received" 
      })
    }

    // Default response for other webhook types
    return NextResponse.json({ 
      success: true, 
      message: "Webhook received" 
    })

  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error)
    
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  // Some webhook services require GET endpoint verification
  return NextResponse.json({ 
    status: "WhatsApp webhook endpoint active",
    timestamp: new Date().toISOString()
  })
} 