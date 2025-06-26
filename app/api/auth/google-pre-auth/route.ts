import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { mode, referralCode, returnTo = '/dashboard' } = await request.json()
    
    // Store auth mode in cookies for callback validation
    const response = NextResponse.json({ success: true })
    
    // Set cookies that will be available in the callback
    response.cookies.set('auth_mode', mode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    })
    
    // Only validate user exists for sign-in attempts, not sign-up
    response.cookies.set('validate_user_exists', mode === 'sign_in' ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    })
    
    // Store referral code for sign-up attempts
    if (mode === 'sign_up' && referralCode) {
      response.cookies.set('referral_code', referralCode, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300 // 5 minutes
      })
    }
    
    return response
  } catch (error) {
    console.error('Error in google-pre-auth endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 