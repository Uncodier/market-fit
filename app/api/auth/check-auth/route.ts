import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log("Authentication check initiated");
    
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    })
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error("Session error:", error);
      return NextResponse.json({ 
        authenticated: false, 
        error: error.message
      })
    }
    
    if (session) {
      console.log("Authenticated user:", session.user.email);
      return NextResponse.json({ 
        authenticated: true, 
        user: {
          id: session.user.id,
          email: session.user.email
        }
      })
    } else {
      console.log("No active session");
      return NextResponse.json({ authenticated: false })
    }
  } catch (e: any) {
    console.error("Error checking authentication:", e);
    return NextResponse.json({ 
      authenticated: false, 
      error: e.message 
    }, { status: 500 })
  }
} 