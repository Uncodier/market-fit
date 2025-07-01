import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const returnTo = requestUrl.searchParams.get('returnTo') || '/dashboard'

    console.log("Auth callback: Processing code=", !!code, "returnTo=", returnTo);

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      console.log("🔄 Attempting to exchange code for session")
      
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("Auth callback error:", error);
        
        // Handle PKCE-specific errors
        if (error.message.includes('code verifier') || error.message.includes('code challenge')) {
          console.log('🔧 PKCE error detected, clearing auth state and redirecting')
          
          // Create response that clears auth cookies
          const response = NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent('Authentication session expired. Please try signing in again.')}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
          
          // Clear potential problematic cookies
          const cookiesToClear = [
            'sb-auth-token',
            'supabase-auth-token',
            'pkce_verifier',
            'sb-provider-token'
          ]
          
          cookiesToClear.forEach(cookieName => {
            response.cookies.delete(cookieName)
            response.cookies.set(cookieName, '', { 
              expires: new Date(0),
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax'
            })
          })
          
          return response
        }
        
        return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
      }

      console.log("✅ Auth callback success, session established for:", data.session?.user.email);
      console.log("📋 Session details:", {
        hasSession: !!data.session,
        hasUser: !!data.session?.user,
        userId: data.session?.user?.id,
        email: data.session?.user?.email,
        provider: data.session?.user?.app_metadata?.provider
      });
      
      // Verify session is properly established
      if (!data.session || !data.session.user) {
        console.error("No session or user found after successful OAuth exchange");
        return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent('Authentication failed - no session established')}&returnTo=${encodeURIComponent(returnTo)}`, request.url));
      }

      // Add a small delay to ensure cookies are set properly
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Add headers to ensure proper session handling
      const successResponse = NextResponse.redirect(new URL(returnTo, request.url))
      successResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      successResponse.headers.set('Pragma', 'no-cache')
      successResponse.headers.set('Set-Cookie', 'auth_confirmed=true; Path=/; Max-Age=60; SameSite=Lax')
      
      console.log("🎯 Redirecting to:", returnTo, "with session for user:", data.session.user.email);
      
      return successResponse
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(returnTo, request.url))
  } catch (error) {
    console.error("🚨 Auth callback exception:", error);
    
    // For PKCE-related exceptions, provide better error message
    if (error instanceof Error && (error.message.includes('code verifier') || error.message.includes('code challenge'))) {
      return NextResponse.redirect(new URL('/auth?error=Authentication%20session%20expired.%20Please%20try%20again.', request.url));
    }
    
    return NextResponse.redirect(new URL('/auth?error=Authentication%20failed', request.url));
  }
} 