export const dynamic = 'force-dynamic';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const returnTo = requestUrl.searchParams.get('returnTo') || '/dashboard'

    // Check if this is a team invitation callback
    const invitationType = requestUrl.searchParams.get('invitationType')
    const siteId = requestUrl.searchParams.get('siteId')
    const siteName = requestUrl.searchParams.get('siteName')
    const role = requestUrl.searchParams.get('role')
    const name = requestUrl.searchParams.get('name')
    const position = requestUrl.searchParams.get('position')

    console.log(`Auth callback: Processing code=${!!code}, redirecting to ${returnTo}`);
    
    // If this is a team invitation, log it
    if (invitationType === 'team_invitation') {
      console.log(`🎯 Team invitation callback detected:`, { siteId, siteName, role });
    }

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("Auth callback error:", error);
        
        // Handle PKCE flow errors specifically for team invitations
        if ((error.message.includes('code verifier') || error.message.includes('auth code and code verifier')) && invitationType === 'team_invitation') {
          console.log('🔄 PKCE error for team invitation, clearing auth state and redirecting to auth');
          
          // Preserve invitation params in the auth redirect
          const authUrl = new URL('/auth', request.url)
          authUrl.searchParams.set('error', 'Please sign in to accept your team invitation')
          authUrl.searchParams.set('returnTo', `/auth/team-invitation?${requestUrl.searchParams.toString().replace('code=', '').replace(/&code=[^&]*/, '')}`)
          
          const response = NextResponse.redirect(authUrl)
          
          // Clear all Supabase auth cookies to prevent PKCE conflicts
          const cookiesToClear = [
            'supabase-auth-token',
            'sb-rnjgeloamtszdjplmqxy-auth-token',
            'sb-rnjgeloamtszdjplmqxy-auth-token.0',
            'sb-rnjgeloamtszdjplmqxy-auth-token.1',
            'supabase.auth.token',
            'pkce_verifier',
            'auth_mode',
            'validate_user_exists'
          ]
          
          cookiesToClear.forEach(cookieName => {
            response.cookies.delete(cookieName)
            response.cookies.set(cookieName, '', { 
              expires: new Date(0),
              path: '/',
              domain: process.env.NODE_ENV === 'production' ? '.uncodie.com' : undefined
            })
          })
          
          return response
        }
        
        return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
      }

      // Check for team invitation - either from URL params or user metadata
      let teamInvitationData = null
      
      if (invitationType === 'team_invitation' && siteId && siteName && role) {
        // Team invitation data from URL parameters
        teamInvitationData = { siteId, siteName, role, name, position }
      } else if (data.session?.user?.user_metadata?.invitationType === 'team_invitation') {
        // Team invitation data from user metadata (fallback when emailRedirectTo is ignored)
        const metadata = data.session.user.user_metadata
        teamInvitationData = {
          siteId: metadata.siteId,
          siteName: metadata.siteName,
          role: metadata.role,
          name: metadata.name,
          position: metadata.position
        }
        console.log(`🔄 Team invitation found in user metadata:`, teamInvitationData);
      }

      // If this is a team invitation and user is now authenticated, redirect to team invitation processor
      if (teamInvitationData && data.session?.user) {
        console.log(`🔄 Redirecting to team invitation processor for ${data.session.user.email}`);
        
        const invitationParams = new URLSearchParams({
          siteId: teamInvitationData.siteId,
          siteName: teamInvitationData.siteName,
          role: teamInvitationData.role,
          ...(teamInvitationData.name && { name: teamInvitationData.name }),
          ...(teamInvitationData.position && { position: teamInvitationData.position }),
          type: 'team_invitation'
        })
        
        const invitationUrl = `/auth/team-invitation?${invitationParams.toString()}`
        
        const invitationResponse = NextResponse.redirect(new URL(invitationUrl, request.url))
        invitationResponse.cookies.delete('auth_mode')
        invitationResponse.cookies.delete('validate_user_exists')
        
        return invitationResponse
      }
      
      // Check if this was a sign-in attempt that needs user validation
      const authModeCookie = (await cookieStore).get('auth_mode')
      const validateUserExistsCookie = (await cookieStore).get('validate_user_exists')
      
      const authMode = authModeCookie?.value
      const validateUserExists = validateUserExistsCookie?.value === 'true'
      
      // Only validate user existence for sign-in attempts, not sign-up
      if (validateUserExists && authMode === 'sign_in' && data.session?.user) {
        const user = data.session.user
        const userEmail = user.email
        
        // Check if this is a new user (just created) vs existing user
        const createdAt = new Date(user.created_at)
        const now = new Date()
        const timeDiff = now.getTime() - createdAt.getTime()
        const isNewUser = timeDiff < 10000 // User created less than 10 seconds ago
        
        if (isNewUser) {
          // Check if there's already a user with this email using different auth method
          const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
          
          if (!listError && existingUsers) {
            // Find if there's another user with same email but different provider
            const existingUserWithSameEmail = existingUsers.users.find(existingUser => 
              existingUser.email === userEmail && 
              existingUser.id !== user.id // Different user ID
            )
            
            if (existingUserWithSameEmail) {
              // Get the authentication method of the existing user
              const existingAuthMethod = existingUserWithSameEmail.app_metadata?.provider || 'email'
              
              console.log(`User ${userEmail} already exists with ${existingAuthMethod} auth, attempted Google sign-in`);
              
              // Delete the newly created Google user
              await supabase.auth.admin.deleteUser(user.id)
              
              // Sign out the current session
              await supabase.auth.signOut()
              
              // Create specific error message based on existing auth method
              let errorMessage = ''
              if (existingAuthMethod === 'email') {
                errorMessage = `An account with ${userEmail} already exists. Please sign in with your email and password instead, or reset your password if you've forgotten it.`
              } else {
                errorMessage = `An account with ${userEmail} already exists using ${existingAuthMethod}. Please use that method to sign in.`
              }
              
              // Clear the auth mode cookies
              const errorResponse = NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(errorMessage)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
              errorResponse.cookies.delete('auth_mode')
              errorResponse.cookies.delete('validate_user_exists')
              
              return errorResponse
            }
          }
          
          // If no existing user found, it's truly a new user attempting sign-in
          console.log("New user attempting sign-in, deleting user and showing error");
          
          // Delete the newly created user
          await supabase.auth.admin.deleteUser(user.id)
          
          // Sign out the current session
          await supabase.auth.signOut()
          
          // Clear the auth mode cookies
          const errorResponse = NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent('No account found with this Google account. Please sign up first.')}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
          errorResponse.cookies.delete('auth_mode')
          errorResponse.cookies.delete('validate_user_exists')
          
          return errorResponse
        }
      }
      
      // Handle successful sign-up with Google
      if (authMode === 'sign_up' && data.session?.user) {
        const user = data.session.user
        const userEmail = user.email
        
        // Check if this is a new user (just created) vs existing user
        const createdAt = new Date(user.created_at)
        const now = new Date()
        const timeDiff = now.getTime() - createdAt.getTime()
        const isNewUser = timeDiff < 10000 // User created less than 10 seconds ago
        
        if (isNewUser) {
          // Check if there's already a user with this email using different auth method
          const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
          
          if (!listError && existingUsers) {
            // Find if there's another user with same email but different provider
            const existingUserWithSameEmail = existingUsers.users.find(existingUser => 
              existingUser.email === userEmail && 
              existingUser.id !== user.id // Different user ID
            )
            
            if (existingUserWithSameEmail) {
              // Get the authentication method of the existing user
              const existingAuthMethod = existingUserWithSameEmail.app_metadata?.provider || 'email'
              
              console.log(`User ${userEmail} already exists with ${existingAuthMethod} auth, attempted Google sign-up`);
              
              // Delete the newly created Google user
              await supabase.auth.admin.deleteUser(user.id)
              
              // Sign out the current session
              await supabase.auth.signOut()
              
              // Create specific error message based on existing auth method
              let errorMessage = ''
              if (existingAuthMethod === 'email') {
                errorMessage = `An account with ${userEmail} already exists. Please sign in with your email and password instead, or reset your password if you've forgotten it.`
              } else {
                errorMessage = `An account with ${userEmail} already exists using ${existingAuthMethod}. Please use that method to sign in.`
              }
              
              // Clear the auth mode cookies
              const errorResponse = NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(errorMessage)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
              errorResponse.cookies.delete('auth_mode')
              errorResponse.cookies.delete('validate_user_exists')
              
              return errorResponse
            }
          }
          
          // New user created successfully with Google sign-up, log them in automatically
          console.log("New user created successfully with Google sign-up, logging in automatically:", userEmail);
          
          // Process referral code if provided
          const referralCodeCookie = (await cookieStore).get('referral_code')
          if (referralCodeCookie?.value) {
            try {
              const referralResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/process-referral`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ referralCode: referralCodeCookie.value })
              })
              
              if (!referralResponse.ok) {
                console.warn('Failed to process referral code after Google sign-up')
              } else {
                console.log('Successfully processed referral code after Google sign-up')
              }
            } catch (error) {
              console.warn('Error processing referral code after Google sign-up:', error)
            }
          }
        }
      }
      
      console.log("Auth callback success, session established for:", data.session?.user.email);
      
      // Clear the auth mode cookies on successful authentication
      const successResponse = NextResponse.redirect(new URL(returnTo, request.url))
      successResponse.cookies.delete('auth_mode')
      successResponse.cookies.delete('validate_user_exists')
      successResponse.cookies.delete('referral_code')
      
      return successResponse
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(returnTo, request.url))
  } catch (error) {
    console.error("Auth callback exception:", error);
    return NextResponse.redirect(new URL('/auth?error=Authentication%20failed', request.url));
  }
} 