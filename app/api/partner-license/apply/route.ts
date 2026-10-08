import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { z } from "zod"

const requestSchema = z.object({ license_key: z.string().uuid(), site_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: "A valid license and site are required" }, { status: 400 })
    const { license_key, site_id } = parsed.data

    const access = await requireSiteAccess(req, site_id, { requireManager: true })
    if (access.error) return access.error

    const supabaseAdmin = await createServiceClient()

    // Claim and entitlement transition must succeed together, including retries.
    const { data, error } = await supabaseAdmin.rpc("apply_site_partner_license", {
      p_license_key: license_key, p_site_id: site_id, p_actor_id: access.userId,
    })
    if (error) {
      if (error.code === "42501") return NextResponse.json({ success: false, error: "The license or site is not available to your account" }, { status: 403 })
      if (error.code === "22023") return NextResponse.json({ success: false, error: "This license is not active" }, { status: 400 })
      const conflicts: Record<string, string> = {
        PARTNER_LICENSE_LINKED: "This license is already linked to another site",
        PARTNER_STRIPE_CONFLICT: "Review your existing Stripe subscription with billing support before applying a lifetime license",
        PARTNER_BILLING_MISSING: "Initialize this site's billing before applying its license",
      }
      if (error.code === "P0001" && conflicts[error.message]) {
        return NextResponse.json({ success: false, error: conflicts[error.message] }, { status: 409 })
      }
      return NextResponse.json({ success: false, error: "License application is temporarily unavailable. Please try again later." }, { status: 503 })
    }
    if (data?.success !== true || (data.plan !== "engine" && data.plan !== "foundry")) {
      return NextResponse.json({ success: false, error: "The license could not be applied" }, { status: 503 })
    }
    return NextResponse.json({ success: true, plan: data.plan })

  } catch {
    return NextResponse.json({ success: false, error: "License application is temporarily unavailable. Please try again later." }, { status: 503 })
  }
}
