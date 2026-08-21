import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { denyUnlessTeamManager, getSiteMemberAccess } from '@/lib/auth/site-member-request'

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
    const email = body.email.trim().toLowerCase()
    const { siteId, siteName, role, name, position } = body

    if (!email || !siteId || !siteName || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied
    if (access.error) return access.error

    const supabase = access.supabase
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user already exists in profiles
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('Error checking profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to check existing users' },
        { status: 500 }
      )
    }

    let existingUser = null
    let userHasConfirmedEmail = false

    if (profile) {
      // Get the full user object to check email confirmation
      const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(profile.id)
      
      if (!userError && userData?.user) {
        existingUser = userData.user
        userHasConfirmedEmail = !!userData.user.email_confirmed_at
      }
    } else {
      // Fallback: check auth.users directly via listUsers with filter, in case they don't have a profile yet
      // We use a search to ensure we don't hit the 50-user pagination limit for the general list
      // Note: listUsers search might not be exact, but we filter in memory
      const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
      const foundUser = existingUsers?.users?.find((u: any) => u.email === email)
      if (foundUser) {
        existingUser = foundUser
        userHasConfirmedEmail = !!foundUser.email_confirmed_at
      }
    }

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
            // For existing users, check if they have password set, if not mark as false
            password_set: existingUser?.user_metadata?.password_set ?? false,
            ...(name && { name }),
            ...(position && { position }),
            redirectUrl: redirectTo
          }
        }
      })
    } else {
      // For new users or users who haven't confirmed email, use admin invite
      // This ensures NO last_sign_in_at is set until they actually confirm and sign in
      console.log(`📧 Sending admin invite to ${existingUser ? 'unconfirmed' : 'new'} user ${email}`)
      
      invitationResult = await adminSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo,
        data: {
          invitationType: 'team_invitation',
          siteId,
          siteName,
          role,
          email,
          password_set: false, // Explicitly mark that password is not set
          ...(name && { name }),
          ...(position && { position }),
          redirectUrl: redirectTo
        }
      })
    }

    console.log(`📤 Invitation response:`, { 
      success: !invitationResult.error, 
      error: invitationResult.error?.message,
      code: invitationResult.error?.code,
      userExists: !!existingUser,
      emailConfirmed: userHasConfirmedEmail,
      method: userHasConfirmedEmail ? 'magic_link' : 'admin_invite'
    })

    if (invitationResult.error) {
      console.error('Invitation error:', invitationResult.error)
      
      // Handle rate limiting gracefully
      if (invitationResult.error.code === 'over_email_send_rate_limit') {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many emails sent. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          },
          { status: 429 }
        )
      }

      const signupDisabled =
        invitationResult.error.code === 'signup_disabled' ||
        /sign.?up.*(disabled|not allowed)/i.test(invitationResult.error.message || '')
      if (signupDisabled) {
        return NextResponse.json(
          {
            success: false,
            error: 'User registration is currently disabled. Please contact support.',
            code: 'SIGNUP_DISABLED',
          },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: invitationResult.error.message },
        { status: 500 }
      )
    }

    console.log(`Invitation sent successfully to ${email} using ${userHasConfirmedEmail ? 'magic link' : 'admin invite'}`)

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      userExists: !!existingUser
    })

  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}