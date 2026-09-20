import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"

const MAX_BODY_BYTES = 32 * 1024

const webhookSchema = z.object({
  AccountSid: z.string().max(64).optional(),
  From: z.string().max(64).optional(),
  To: z.string().max(64).optional(),
  Body: z.string().max(4096).optional(),
  MessageSid: z.string().max(64).optional(),
  ComplianceStatus: z.string().max(64).optional(),
  PhoneNumber: z.string().max(64).optional(),
  metadata: z.string().max(4096).optional(),
})

const metadataSchema = z.object({
  siteId: z.string().uuid(),
})

function getWebhookUrl(request: NextRequest): string {
  const configured = process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim()
  if (configured) return configured

  const url = new URL(request.url)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedHost) url.host = forwardedHost.split(",")[0].trim()
  if (forwardedProto) url.protocol = `${forwardedProto.split(",")[0].trim()}:`
  return url.toString()
}

export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) {
      return NextResponse.json(
        { error: "Webhook verification is unavailable" },
        { status: 503 }
      )
    }

    const rawBody = decodeRequestBody(
      await readLimitedRequestBody(request, MAX_BODY_BYTES)
    )
    const signature = request.headers.get("x-twilio-signature")
    if (!signature) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    const contentType = request.headers.get("content-type") || ""
    let rawPayload: unknown
    let signatureValid = false
    if (contentType.includes("application/json")) {
      signatureValid = twilio.validateRequestWithBody(
        authToken,
        signature,
        getWebhookUrl(request),
        rawBody
      )
      rawPayload = JSON.parse(rawBody)
    } else {
      const params = Object.fromEntries(new URLSearchParams(rawBody).entries())
      signatureValid = twilio.validateRequest(
        authToken,
        signature,
        getWebhookUrl(request),
        params
      )
      rawPayload = params
    }

    if (!signatureValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    const parsed = webhookSchema.safeParse(rawPayload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      )
    }

    const { From, Body, ComplianceStatus, PhoneNumber, metadata } = parsed.data

    if (ComplianceStatus) {
      let siteInfo: z.infer<typeof metadataSchema> | null = null
      if (metadata) {
        try {
          const parsedMetadata = metadataSchema.safeParse(JSON.parse(metadata))
          siteInfo = parsedMetadata.success ? parsedMetadata.data : null
        } catch {
          return NextResponse.json(
            { error: "Invalid webhook metadata" },
            { status: 400 }
          )
        }
      }

      if (ComplianceStatus === 'approved' && siteInfo?.siteId) {
        const supabase = await createServiceClient()
        const { data: existingSettings } = await supabase
          .from('settings')
          .select('*')
          .eq('site_id', siteInfo.siteId)
          .single()

        // Merge with existing settings to preserve all fields
        const updatedSettings = {
          ...existingSettings,
          site_id: siteInfo.siteId,
          whatsapp: {
            enabled: true,
            setupType: "port_existing",
            existingNumber: PhoneNumber,
            setupRequested: true,
            status: "connected"
          },
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('settings')
          .upsert(updatedSettings, {
            onConflict: 'site_id',
            ignoreDuplicates: false
          })

        if (updateError) {
          console.error("Failed to persist WhatsApp compliance status")
          return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: "Compliance status processed" 
      })
    }

    if (From && Body) {
      return NextResponse.json({ 
        success: true, 
        message: "WhatsApp message received" 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Webhook received" 
    })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      )
    }
    console.error("Error processing WhatsApp webhook:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    status: "WhatsApp webhook endpoint active",
    timestamp: new Date().toISOString()
  })
} 