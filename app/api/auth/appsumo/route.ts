import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    // Si AppSumo hace un ping de validación sin código, devolvemos 200 OK
    // en lugar de una redirección para asegurar que pase la validación en su UI.
    return new NextResponse('Ready for OAuth', { status: 200 })
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

    // 4. Update the license and redirect to selection screen
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

    // Instead of auto-applying to a random site, we redirect the user to the selection screen
    const res = NextResponse.redirect(new URL(`/partner-license/select-site?license=${license_key}`, req.url))
    res.cookies.delete('appsumo_pending_license')
    return res

  } catch (error) {
    console.error('AppSumo OAuth Error:', error)
    return NextResponse.redirect(new URL('/login?error=appsumo_oauth_failed', req.url))
  }
}
