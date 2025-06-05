import { createClient } from "@/lib/supabase/client"

export interface MagicLinkInvitationParams {
  email: string
  siteId: string
  siteName: string
  role: string
  name?: string
  position?: string
}

export interface MagicLinkInvitationResponse {
  success: boolean
  message?: string
  error?: string
}

/**
 * Generate a magic link invitation for team members using Supabase Auth
 * This replaces the previous SendGrid email system with Supabase's built-in magic links
 */
export async function sendMagicLinkInvitation(
  params: MagicLinkInvitationParams
): Promise<MagicLinkInvitationResponse> {
  try {
    const supabase = createClient()
    
    // Get current site information for the invitation context
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('name, user_id')
      .eq('id', params.siteId)
      .single()
    
    if (siteError || !siteData) {
      throw new Error('Site not found or access denied')
    }

    // Check if user is authorized to send invitations for this site
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No authenticated user found')
    }

    // Verify user has permission to invite to this site
    const { data: membershipCheck } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', params.siteId)
      .eq('user_id', user.id)
      .single()

    const isOwner = siteData.user_id === user.id
    const isAdmin = membershipCheck?.role === 'admin' || membershipCheck?.role === 'owner'
    
    if (!isOwner && !isAdmin) {
      throw new Error('Insufficient permissions to send invitations')
    }

    // Create redirect URL with invitation parameters
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const invitationParams = new URLSearchParams({
      siteId: params.siteId,
      siteName: params.siteName,
      role: params.role,
      ...(params.name && { name: params.name }),
      ...(params.position && { position: params.position }),
      type: 'team_invitation'
    })
    
    const redirectTo = `${baseUrl}/auth/team-invitation?${invitationParams.toString()}`

    // Send magic link using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: params.email,
      options: {
        shouldCreateUser: false, // Don't create user automatically
        emailRedirectTo: redirectTo,
        data: {
          // Include invitation context in user metadata
          invitationType: 'team_invitation',
          siteId: params.siteId,
          siteName: params.siteName,
          role: params.role,
          name: params.name,
          position: params.position,
          invitedBy: user.id,
          invitedByEmail: user.email
        }
      }
    })

    if (authError) {
      console.error('Magic link generation error:', authError)
      throw new Error(`Failed to send invitation: ${authError.message}`)
    }

    console.log(`Magic link invitation sent successfully to ${params.email}`)
    
    return {
      success: true,
      message: `Invitation sent successfully to ${params.email}`
    }

  } catch (error) {
    console.error('Error sending magic link invitation:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Resend magic link invitation
 */
export async function resendMagicLinkInvitation(
  params: MagicLinkInvitationParams
): Promise<MagicLinkInvitationResponse> {
  return sendMagicLinkInvitation(params)
}

/**
 * Process team invitation when user clicks magic link
 * This function should be called from the invitation landing page
 */
export async function processTeamInvitation(invitationData: {
  siteId: string
  siteName: string
  role: string
  name?: string
  position?: string
  userEmail: string
}): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  try {
    const supabase = createClient()
    
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return {
        success: false,
        error: 'Please authenticate first to accept the invitation'
      }
    }

    // Verify the invitation is valid and for the correct email
    if (user.email !== invitationData.userEmail) {
      return {
        success: false,
        error: 'This invitation is for a different email address'
      }
    }

    // Check if user is already a member of this site
    const { data: existingMember } = await supabase
      .from('site_members')
      .select('*')
      .eq('site_id', invitationData.siteId)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      return {
        success: true,
        redirectTo: `/dashboard/sites/${invitationData.siteId}`,
        error: 'You are already a member of this site'
      }
    }

    // Map invitation role to site member role
    let siteMemberRole: 'admin' | 'marketing' | 'collaborator' = 'collaborator'
    switch (invitationData.role) {
      case 'admin':
        siteMemberRole = 'admin'
        break
      case 'create':
      case 'delete':
        siteMemberRole = 'marketing'
        break
      case 'view':
      default:
        siteMemberRole = 'collaborator'
        break
    }

    // Add user to site members
    const { error: insertError } = await supabase
      .from('site_members')
      .insert({
        site_id: invitationData.siteId,
        user_id: user.id,
        email: user.email,
        role: siteMemberRole,
        name: invitationData.name || user.user_metadata?.name,
        position: invitationData.position,
        status: 'active' // User is active since they authenticated
      })

    if (insertError) {
      console.error('Error adding user to site:', insertError)
      return {
        success: false,
        error: 'Failed to add you to the site. Please try again.'
      }
    }

    return {
      success: true,
      redirectTo: `/dashboard/sites/${invitationData.siteId}`
    }

  } catch (error) {
    console.error('Error processing team invitation:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while processing your invitation'
    }
  }
} 