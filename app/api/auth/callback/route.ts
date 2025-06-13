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
        return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}&returnTo=${encodeURIComponent(returnTo)}`, request.url))
      }

      // If this is a team invitation and user is now authenticated, redirect to team invitation processor
      if (invitationType === 'team_invitation' && siteId && siteName && role && data.session?.user) {
        console.log(`🔄 Redirecting to team invitation processor for ${data.session.user.email}`);
        
        const invitationParams = new URLSearchParams({
          siteId,
          siteName,
          role,
          ...(name && { name }),
          ...(position && { position }),
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
      
      console.log("Auth callback success, session established for:", data.session?.user.email);
      
      // Clear the auth mode cookies on successful authentication
      const successResponse = NextResponse.redirect(new URL(returnTo, request.url))
      successResponse.cookies.delete('auth_mode')
      successResponse.cookies.delete('validate_user_exists')
      
      return successResponse
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(returnTo, request.url))
  } catch (error) {
    console.error("Auth callback exception:", error);
    return NextResponse.redirect(new URL('/auth?error=Authentication%20failed', request.url));
  }
} 