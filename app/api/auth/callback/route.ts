export const dynamic = 'force-dynamic';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const returnTo = requestUrl.searchParams.get('returnTo') || '/dashboard'

    // Log callback debug info
    console.log(`Auth callback: Processing code=${!!code}, redirecting to ${returnTo}`);

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("Auth callback error:", error);
        return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
      }
      
      console.log("Auth callback success, session established for:", data.session?.user.email);
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(returnTo, request.url))
  } catch (error) {
    console.error("Auth callback exception:", error);
    return NextResponse.redirect(new URL('/auth?error=Authentication%20failed', request.url));
  }
} 