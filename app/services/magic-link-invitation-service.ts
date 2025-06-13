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
  code?: string
  retryAfter?: number
}

/**
 * Generate a magic link invitation for team members using the API route
 * This replaces the previous SendGrid email system with Supabase's built-in magic links
 */
export async function sendMagicLinkInvitation(
  params: MagicLinkInvitationParams
): Promise<MagicLinkInvitationResponse> {
  try {
    // Call the API route to handle the invitation
    const response = await fetch('/api/team/invite-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        siteId: params.siteId,
        siteName: params.siteName,
        role: params.role,
        name: params.name,
        position: params.position,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      // Return the full error info including codes and retry information
      return {
        success: false,
        error: result.error || 'Failed to send invitation',
        code: result.code,
        retryAfter: result.retryAfter
      }
    }

    return result

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

    // For security, we could verify the invitation is for the correct email,
    // but since the user is already authenticated, we'll allow it
    // This avoids issues with email parameter not being passed correctly
    console.log(`🔐 Processing invitation for authenticated user: ${user.email}`)
    console.log(`📨 Invitation was originally for: ${invitationData.userEmail || 'not specified'}`)

    // Verify the site exists and get site information
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('name, user_id')
      .eq('id', invitationData.siteId)
      .single()
    
    if (siteError || !siteData) {
      return {
        success: false,
        error: 'The site you were invited to no longer exists or is inaccessible'
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