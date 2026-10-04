import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

export async function POST(req: NextRequest) {
  try {
    const { license_key, site_id } = await req.json()

    if (typeof license_key !== 'string' || !license_key.trim() || typeof site_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(site_id)) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
    }

    const access = await requireSiteAccess(req, site_id, { requireManager: true })
    if (access.error) return access.error

    const supabaseAdmin = await createServiceClient()

    // Verify license exists and belongs to this user
    const { data: licenseDb, error: licenseError } = await supabaseAdmin
      .from('partner_licenses')
      .select('*')
      .eq('license_key', license_key)
      .eq('user_id', access.userId)
      .single()

    if (licenseError || !licenseDb) {
      return NextResponse.json({ success: false, error: "License not found or does not belong to you" }, { status: 404 })
    }

    if (licenseDb.status === 'deactivated') {
      return NextResponse.json({ success: false, error: "This license has been deactivated" }, { status: 400 })
    }
    if (licenseDb.site_id && licenseDb.site_id !== site_id) {
      return NextResponse.json({ success: false, error: "License is already linked to another site" }, { status: 409 })
    }

    // Determine target plan
    let targetPlan: 'engine' | 'foundry' = 'engine' // Default
    
    const actualPlanName = licenseDb.plan_name?.toLowerCase() || ''
    if (actualPlanName.includes('foundry') || actualPlanName.includes('tier 2') || actualPlanName.includes('tier2')) {
      targetPlan = 'foundry'
    }

    // Update the license with the selected site_id
    const { error: updateLicenseError } = await supabaseAdmin
      .from('partner_licenses')
      .update({ site_id: site_id })
      .eq('license_key', license_key)
      .eq('user_id', access.userId)
      .or(`site_id.is.null,site_id.eq.${site_id}`)
      .select('id')
      .single()

    if (updateLicenseError) {
      console.error("Error linking site to license:", updateLicenseError)
      return NextResponse.json({ success: false, error: "Failed to link license to site" }, { status: 500 })
    }

    // SQL owns the plan bucket transition; never overwrite purchased credits
    // with an aggregate balance read before concurrent usage or purchases.
    const { error: billingError } = await supabaseAdmin
      .from('billing')
      .update({
        plan: targetPlan,
        subscription_status: 'active',
        auto_renew: false,
        updated_at: new Date().toISOString()
      })
      .eq('site_id', site_id)
    
    if (billingError) {
      console.error("Error updating billing:", billingError)
      return NextResponse.json({ success: false, error: "Failed to apply billing plan" }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: targetPlan })

  } catch (error: unknown) {
    console.error("Error applying partner license:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
