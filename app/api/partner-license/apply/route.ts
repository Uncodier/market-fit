import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const { license_key, site_id } = await req.json()

    if (!license_key || !site_id) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
    }

    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = await createServiceClient()

    // Verify user belongs to the site
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('site_members')
      .select('role')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ success: false, error: "User is not a member of this site" }, { status: 403 })
    }

    // Verify license exists and belongs to this user
    const { data: licenseDb, error: licenseError } = await supabaseAdmin
      .from('partner_licenses')
      .select('*')
      .eq('license_key', license_key)
      .eq('user_id', user.id)
      .single()

    if (licenseError || !licenseDb) {
      return NextResponse.json({ success: false, error: "License not found or does not belong to you" }, { status: 404 })
    }

    if (licenseDb.status === 'deactivated') {
      return NextResponse.json({ success: false, error: "This license has been deactivated" }, { status: 400 })
    }

    // Determine target plan
    let targetPlan: 'engine' | 'foundry' = 'engine' // Default
    let baseCredits = 20
    
    const actualPlanName = licenseDb.plan_name?.toLowerCase() || ''
    if (actualPlanName.includes('foundry') || actualPlanName.includes('tier 2') || actualPlanName.includes('tier2')) {
      targetPlan = 'foundry'
      baseCredits = 100
    }

    // Get current billing to respect extra credits purchased
    const { data: currentBilling } = await supabaseAdmin
      .from('billing')
      .select('credits_available')
      .eq('site_id', site_id)
      .single()
      
    const currentCredits = currentBilling?.credits_available || 0
    const newCredits = Math.max(currentCredits, baseCredits)

    // Update the license with the selected site_id
    const { error: updateLicenseError } = await supabaseAdmin
      .from('partner_licenses')
      .update({ site_id: site_id })
      .eq('license_key', license_key)

    if (updateLicenseError) {
      console.error("Error linking site to license:", updateLicenseError)
      return NextResponse.json({ success: false, error: "Failed to link license to site" }, { status: 500 })
    }

    // Apply billing changes
    const { error: billingError } = await supabaseAdmin
      .from('billing')
      .update({
        plan: targetPlan,
        credits_available: newCredits,
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

  } catch (error: any) {
    console.error("Error applying partner license:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
