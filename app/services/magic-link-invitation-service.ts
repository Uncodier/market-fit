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
      const code =
        result.code ||
        (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : undefined)
      return {
        success: false,
        error: result.error || 'Failed to send invitation',
        code,
        retryAfter: result.retryAfter || (response.status === 429 ? 60 : undefined),
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
    const response = await fetch('/api/team/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: invitationData.siteId }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to accept the invitation',
      }
    }

    return result
  } catch (error) {
    console.error('Error processing team invitation:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while processing your invitation'
    }
  }
} 