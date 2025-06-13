import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface InvitationRequest {
  email: string
  siteId: string
  siteName: string
  role: string
  name?: string
  position?: string
}

export async function POST(request: Request) {
  try {
    const body: InvitationRequest = await request.json()
    const { email, siteId, siteName, role, name, position } = body

    if (!email || !siteId || !siteName || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create client for user authentication using SSR
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Check if current user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify user has permission to invite to this site
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('name, user_id')
      .eq('id', siteId)
      .single()
    
    if (siteError || !siteData) {
      return NextResponse.json(
        { success: false, error: 'Site not found or access denied' },
        { status: 404 }
      )
    }

    const { data: membershipCheck } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', siteId)
      .eq('user_id', user.id)
      .single()

    const isOwner = siteData.user_id === user.id
    const isAdmin = membershipCheck?.role === 'admin' || membershipCheck?.role === 'owner'
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to send invitations' },
        { status: 403 }
      )
    }

    // Create admin client for user operations
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user already exists and has confirmed their email
    const { data: existingUsers, error: listError } = await adminSupabase.auth.admin.listUsers()
    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json(
        { success: false, error: 'Failed to check existing users' },
        { status: 500 }
      )
    }

    const existingUser = existingUsers.users.find((u: any) => u.email === email)
    const userHasConfirmedEmail = existingUser && !!existingUser.email_confirmed_at

    // Create the redirect URL for the magic link
    // Determine base URL: use localhost only in development, production URL otherwise
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://app.uncodie.com')
    
    console.log(`🚀 Detected environment: ${process.env.NODE_ENV}`)
    console.log(`📝 NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'NOT SET'}`)
    console.log(`🎯 Using base URL: ${baseUrl}`)
    
    // Generate a temporary invitation token to avoid URL parameter issues
    const invitationToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    // Store invitation data temporarily (you could use Redis or a temp table)
    // For now, we'll still use URL params as primary and user metadata as backup
    const invitationParams = new URLSearchParams({
      invitationType: 'team_invitation',
      siteId,
      siteName,
      role,
      email, // Include email so we can verify it on the callback
      token: invitationToken, // Add token for extra security
      ...(name && { name }),
      ...(position && { position })
    })
    
    // Use the API auth callback which should be configured as wildcard in Supabase
    const redirectTo = `${baseUrl}/api/auth/callback?${invitationParams.toString()}`
    
    console.log(`🔗 Redirect URL: ${redirectTo}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`)
    console.log(`🏠 Base URL: ${baseUrl}`)

    let invitationResult

    console.log(`🔍 Processing invitation for ${email}`)
    console.log(`📧 User exists: ${!!existingUser}`)
    console.log(`✅ Email confirmed: ${userHasConfirmedEmail}`)

    if (userHasConfirmedEmail) {
      // For users who have confirmed their email, use magic link without creation
      // This avoids any potential last_sign_in_at issues
      console.log(`🔗 Sending magic link to confirmed user ${email}`)
      
      invitationResult = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // User already exists and is confirmed
          emailRedirectTo: redirectTo,
          data: {
            invitationType: 'team_invitation',
            siteId,
            siteName,
            role,
            email,
            ...(name && { name }),
            ...(position && { position }),
            redirectUrl: redirectTo
          }
        }
      })
    } else {
      // For new users or users who haven't confirmed email, use magic link with creation
      // last_sign_in_at won't be set until they actually confirm their email and complete authentication
      console.log(`🔗 Sending magic link to ${existingUser ? 'unconfirmed' : 'new'} user ${email}`)
      
      invitationResult = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Create user if needed, but they must confirm email first
          emailRedirectTo: redirectTo,
          data: {
            invitationType: 'team_invitation',
            siteId,
            siteName,
            role,
            email,
            ...(name && { name }),
            ...(position && { position }),
            redirectUrl: redirectTo
          }
        }
      })
    }

    console.log(`📤 Magic link response:`, { 
      success: !invitationResult.error, 
      error: invitationResult.error?.message,
      code: invitationResult.error?.code,
      userExists: !!existingUser,
      emailConfirmed: userHasConfirmedEmail
    })

    if (invitationResult.error) {
      console.error('Invitation error:', invitationResult.error)
      
      // Handle rate limiting gracefully
      if (invitationResult.error.code === 'over_email_send_rate_limit') {
        return NextResponse.json(
          { success: false, error: 'Too many emails sent. Please try again later.' },
          { status: 429 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: invitationResult.error.message },
        { status: 500 }
      )
    }

    console.log(`Magic link invitation sent successfully to ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      userExists: !!existingUser
    })

  } catch (error) {
    console.error('Error sending magic link invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}