import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Handler for the /api/auth route - helpful for debugging auth issues
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Auth API error:", error);
      return NextResponse.json({ 
        status: 'error', 
        error: error.message 
      }, { status: 500 });
    }
    
    if (session) {
      return NextResponse.json({
        status: 'authenticated',
        user: {
          id: session.user.id,
          email: session.user.email
        },
        session: {
          expires_at: session.expires_at
        }
      });
    } else {
      return NextResponse.json({
        status: 'unauthenticated',
        message: 'No active session found'
      });
    }
  } catch (error: any) {
    console.error("Auth API exception:", error);
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
}

// Handler for POST auth operations (mainly for debugging or API client use)
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    const data = await request.json();
    const { action } = data;
    
    if (action === 'signout') {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return NextResponse.json({
          status: 'error',
          error: error.message
        }, { status: 500 });
      }
      
      return NextResponse.json({
        status: 'success',
        message: 'Signed out successfully'
      });
    }
    
    return NextResponse.json({
      status: 'error',
      message: 'Invalid action'
    }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
} 