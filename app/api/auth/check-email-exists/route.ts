import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Check if user exists in auth.users table
    const { data: existingUsers, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('Error checking email existence:', error)
      return NextResponse.json({ error: 'Failed to check email existence' }, { status: 500 })
    }
    
    const existingUser = existingUsers.users.find(user => user.email === email)
    
    if (existingUser) {
      const authMethod = existingUser.app_metadata?.provider || 'email'
      return NextResponse.json({ 
        exists: true, 
        authMethod,
        userId: existingUser.id
      })
    }
    
    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('Error in check-email-exists endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 