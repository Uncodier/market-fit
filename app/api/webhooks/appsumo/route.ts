import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import { acquireOperationLease } from "@/lib/redis/operation-lease"

const MAX_BODY_BYTES = 32 * 1024
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000

const webhookSchema = z.object({
  action: z.string().max(64).optional(),
  event: z.string().max(64).optional(),
  plan_id: z.string().max(255).optional(),
  partner_plan_name: z.string().max(255).optional(),
  uuid: z.string().uuid().optional(),
  license_key: z.string().uuid().optional(),
  test: z.boolean().optional(),
})

function parseTimestamp(value: string): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric
  }
  return Date.parse(value)
}

export function verifyAppSumoSignature(
  timestamp: string | null,
  signature: string | null,
  body: string
): "valid" | "invalid" | "unconfigured" {
  const apiKey = process.env.APPSUMO_API_KEY
  if (!apiKey) return "unconfigured"
  if (!timestamp || !signature) return "invalid"

  const timestampMs = parseTimestamp(timestamp)
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_SKEW_MS
  ) {
    return "invalid"
  }

  const expected = createHmac("sha256", apiKey)
    .update(timestamp + body)
    .digest("hex")
  const received = signature.replace(/^sha256=/i, "").toLowerCase()
  const expectedBuffer = Buffer.from(expected, "utf8")
  const receivedBuffer = Buffer.from(received, "utf8")

  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
    ? "valid"
    : "invalid"
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = decodeRequestBody(
      await readLimitedRequestBody(req, MAX_BODY_BYTES)
    )
    const signatureStatus = verifyAppSumoSignature(
      req.headers.get("x-appsumo-timestamp"),
      req.headers.get("x-appsumo-signature"),
      bodyText
    )

    if (signatureStatus === "unconfigured") {
      return NextResponse.json(
        { success: false, error: "Webhook verification is unavailable" },
        { status: 503 }
      )
    }
    if (signatureStatus === "invalid") {
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    const parsed = webhookSchema.safeParse(
      bodyText ? JSON.parse(bodyText) : null
    )
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload" },
        { status: 400 }
      )
    }

    const body = parsed.data
    const eventAction = body.event || body.action
    if (body.test === true || eventAction === "test") {
      return NextResponse.json({
        event: eventAction || "purchase",
        success: true,
      })
    }

    const licenseKey = body.license_key || body.uuid
    if (!eventAction || !licenseKey) {
      return NextResponse.json(
        { success: false, error: "Missing event or license key" },
        { status: 400 }
      )
    }

    const lease = await acquireOperationLease(
      "appsumo-license",
      licenseKey,
      15_000
    )
    if (!lease) {
      return NextResponse.json(
        { success: false, error: "Webhook processing is already in progress" },
        { status: 409, headers: { "Retry-After": "2" } }
      )
    }

    try {
      const supabaseAdmin = await createServiceClient()
      let error: { message?: string } | null = null

      if (["activate", "purchase"].includes(eventAction)) {
        const result = await supabaseAdmin.from("partner_licenses").upsert(
          {
            license_key: licenseKey,
            partner: "appsumo",
            status: "active",
            plan_name: body.partner_plan_name || body.plan_id || null,
          },
          { onConflict: "license_key" }
        )
        error = result.error
      } else if (["deactivate", "refund"].includes(eventAction)) {
        const result = await supabaseAdmin
          .from("partner_licenses")
          .update({ status: eventAction === "refund" ? "refunded" : "inactive" })
          .eq("license_key", licenseKey)
        error = result.error
      } else if (["upgrade", "downgrade"].includes(eventAction)) {
        const result = await supabaseAdmin
          .from("partner_licenses")
          .update({ plan_name: body.partner_plan_name || body.plan_id || null })
          .eq("license_key", licenseKey)
        error = result.error
      } else {
        return NextResponse.json(
          { success: false, error: "Unsupported webhook event" },
          { status: 400 }
        )
      }

      if (error) {
        console.error("AppSumo webhook persistence failed")
        return NextResponse.json(
          { success: false, error: "Webhook processing failed" },
          { status: 500 }
        )
      }

      return NextResponse.json({ event: eventAction, success: true })
    } finally {
      await lease.release()
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }
    console.error("AppSumo webhook error:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ success: true, message: "Ready" })
}
