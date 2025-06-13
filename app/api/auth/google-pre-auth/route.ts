import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { authMode, returnTo = '/dashboard' } = await request.json()
    
    // Store auth mode in cookies for callback validation
    const response = NextResponse.json({ success: true })
    
    // Set cookies that will be available in the callback
    response.cookies.set('auth_mode', authMode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    })
    
    response.cookies.set('validate_user_exists', authMode === 'sign_in' ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    })
    
    return response
  } catch (error) {
    console.error('Error in google-pre-auth endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 