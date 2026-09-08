import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_appsumo_code', req.url))
  }

  try {
    // 1. Fetch access token
    const tokenRes = await fetch('https://appsumo.com/openid/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.APPSUMO_CLIENT_ID || '',
        client_secret: process.env.APPSUMO_CLIENT_SECRET || '',
        redirect_uri: process.env.APPSUMO_REDIRECT_URI || '',
        code,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenRes.ok) {
      console.error('AppSumo token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(new URL('/login?error=appsumo_token_exchange', req.url))
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // 2. Fetch license key
    const licenseRes = await fetch(`https://appsumo.com/openid/license_key/?access_token=${accessToken}`)
    if (!licenseRes.ok) {
      console.error('AppSumo license fetch failed:', await licenseRes.text())
      return NextResponse.redirect(new URL('/login?error=appsumo_license_fetch', req.url))
    }

    const licenseData = await licenseRes.json()
    const { license_key, status } = licenseData

    if (status === 'deactivated') {
      return NextResponse.redirect(new URL('/login?error=appsumo_license_deactivated', req.url))
    }

    // 3. User Login/Auth
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    
    if (!user) {
      // If user is not logged in, we save the code or license info in a cookie and redirect to login/signup.
      // After signup, we'd need to pick it up. For simplicity, we redirect them to signup with a special param.
      const res = NextResponse.redirect(new URL(`/login?appsumo_license=${license_key}`, req.url))
      // Also set a secure cookie that expires in 1 hour
      res.cookies.set('appsumo_pending_license', license_key, { 
        maxAge: 3600,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
      return res
    }

    // 4. Update the license and user's billing
    const supabaseAdmin = await createServiceClient()
    
    // Check if license exists in our db
    const { data: licenseDb } = await supabaseAdmin
      .from('partner_licenses')
      .select('*')
      .eq('license_key', license_key)
      .single()

    if (!licenseDb) {
      // It's possible the webhook hasn't arrived yet or failed. We upsert it.
      await supabaseAdmin.from('partner_licenses').upsert({
        license_key,
        partner: 'appsumo',
        status: status,
        plan_name: 'unknown',
        user_id: user.id,
      }, { onConflict: 'license_key' })
    } else {
      // Link the user to the license
      await supabaseAdmin.from('partner_licenses').update({
        user_id: user.id
      }).eq('license_key', license_key)
    }

    // Assign plan based on AppSumo tier
    // We assume the webhook previously saved the real plan_name in `partner_licenses`.
    // We might need to map it. Example: plan_name from AppSumo might be "market-fit-engine"
    let targetPlan: 'engine' | 'foundry' = 'engine' // Default
    let baseCredits = 20
    
    const actualPlanName = licenseDb?.plan_name?.toLowerCase() || ''
    if (actualPlanName.includes('foundry') || actualPlanName.includes('tier 2') || actualPlanName.includes('tier2')) {
      targetPlan = 'foundry'
      baseCredits = 100
    }

    // Look for the user's current site to update billing
    const { data: siteData } = await supabaseAdmin
      .from('site_members')
      .select('site_id')
      .eq('user_id', user.id)
      .limit(1)

    if (siteData && siteData.length > 0) {
      const siteId = siteData[0].site_id
      
      // Update license with site_id
      await supabaseAdmin.from('partner_licenses').update({
        site_id: siteId
      }).eq('license_key', license_key)

      // Get current billing to respect extra credits purchased
      const { data: currentBilling } = await supabaseAdmin
        .from('billing')
        .select('credits_available')
        .eq('site_id', siteId)
        .single()
        
      // AppSumo "top-up maxed" logic:
      // The user gets `baseCredits` each month. Any extra credits purchased (if any) shouldn't be lost.
      // Since AppSumo doesn't have a recurring monthly event, we have a cron or we just set it here.
      // If current is less than baseCredits, top it up. If it's more, leave it (they bought extras).
      const currentCredits = currentBilling?.credits_available || 0
      const newCredits = Math.max(currentCredits, baseCredits)

      // AppSumo is a lifetime deal, so no Stripe customer ID needed
      const { error: billingError } = await supabaseAdmin.from('billing').update({
        plan: targetPlan,
        credits_available: newCredits,
        subscription_status: 'active',
        auto_renew: false,
        updated_at: new Date().toISOString()
      }).eq('site_id', siteId)
      
      if (billingError) {
        console.error("Error updating billing for AppSumo:", billingError)
      }
    }

    // Also we should mark the license as 'active' by responding to AppSumo API if they require it?
    // Actually, AppSumo marks it active once the partner's webhook returns 200 for the `activate` event.
    // We already do that in the webhook.

    // Clear pending cookie
    const res = NextResponse.redirect(new URL('/dashboard', req.url))
    res.cookies.delete('appsumo_pending_license')
    return res

  } catch (error) {
    console.error('AppSumo OAuth Error:', error)
    return NextResponse.redirect(new URL('/login?error=appsumo_oauth_failed', req.url))
  }
}
