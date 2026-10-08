import { createClient } from '@/lib/supabase/client'
import { siteMemberRoleToInvitationRole } from '@/lib/auth/screen-access'
import { assignableSiteMembers } from '@/lib/auth/assignable-site-members'
import { sendMagicLinkInvitation } from './magic-link-invitation-service'
import { BillingUpgradeRequired, isBillingUpgradeRequired, parseBillingLimitError } from '@/lib/billing-limit-errors'
import { publicMemberLicenseSchema } from '@/lib/licenses/member-license-schema'
import type { SiteMemberLicense } from '@/lib/license-entitlements'
import { syncSiteMembersFromSettings } from './site-members-settings-sync'

export interface SiteMember {
  id: string
  site_id: string
  user_id: string | null
  role: 'owner' | 'admin' | 'marketing' | 'collaborator'
  added_by: string | null
  created_at: string
  updated_at: string
  email: string
  name: string | null
  position: string | null
  status: 'pending' | 'active' | 'rejected'
  license_suspended?: boolean
  manually_disabled?: boolean
  is_primary_owner?: boolean
  blocked_screens?: string[]
  restrict_to_assigned_only?: boolean
  emailConfirmed?: boolean // Track if user has confirmed their email
  lastSignIn?: string // Track last sign in to know if user is truly active
}

export interface SiteMemberInput {
  email: string
  role: 'admin' | 'marketing' | 'collaborator'
  name?: string
  position?: string
  blocked_screens?: string[]
  restrict_to_assigned_only?: boolean
}

export class InviteEmailError extends Error {
  readonly member: SiteMember

  constructor(message: string, member: SiteMember) {
    super(message)
    this.name = 'InviteEmailError'
    this.member = member
  }
}

export function isInviteEmailError(error: unknown): error is InviteEmailError {
  return (
    error instanceof Error &&
    error.name === 'InviteEmailError' &&
    'member' in error
  )
}

export const siteMembersService = {
  async getLicense(siteId: string): Promise<SiteMemberLicense> {
    const response = await fetch(`/api/site-members/${encodeURIComponent(siteId)}/license`, { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch member licensing')
    const parsed = publicMemberLicenseSchema.safeParse(result.license)
    if (!parsed.success || parsed.data.siteId !== siteId) throw new Error('Invalid member license response')
    return parsed.data
  },
  // Get all members for a site
  async getMembers(siteId: string): Promise<SiteMember[]> {
    try {
      // Use the API route that has admin access to get complete member data
      const response = await fetch(`/api/site-members/${siteId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch site members: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch site members')
      }
      
      return result.members || []
    } catch (error) {
      console.error('Error fetching site members:', error)
      throw error
    }
  },

  async getAssigneeOptions(siteId: string): Promise<{ id: string; name: string }[]> {
    const members = assignableSiteMembers(await this.getMembers(siteId))
    return members.map((member) => ({
      id: member.user_id,
      name: member.name?.trim() || member.email,
    }))
  },
  
  // Add a new member to a site (owner/admin API — bypasses owner-only RLS)
  async addMember(siteId: string, member: SiteMemberInput, siteName = 'Your Site'): Promise<SiteMember> {
    const response = await fetch(`/api/site-members/${siteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: member.email,
        role: member.role,
        name: member.name,
        position: member.position,
        blocked_screens: member.blocked_screens || [],
        restrict_to_assigned_only: member.restrict_to_assigned_only || false,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
      const upgradeRequired = response.status === 402 ? parseBillingLimitError(result) : null
      if (upgradeRequired?.kind === 'members' && upgradeRequired.siteId === siteId) throw new BillingUpgradeRequired(upgradeRequired)
      throw new Error(result.error || 'Failed to add site member')
    }

    const data = result.member as SiteMember

    try {
      const invitationResult = await sendMagicLinkInvitation({
        email: member.email,
        siteId,
        siteName: siteName || 'Your Site',
        role: siteMemberRoleToInvitationRole(member.role),
        name: member.name,
        position: member.position,
      })

      if (invitationResult.success) {
        return data
      }
      if (invitationResult.upgradeRequired) throw new BillingUpgradeRequired(invitationResult.upgradeRequired)

      if (invitationResult.code === 'RATE_LIMIT_EXCEEDED') {
        throw new InviteEmailError(
          `Rate limit exceeded for ${member.email}. Please wait ${invitationResult.retryAfter || 60} seconds before trying again.`,
          data
        )
      }

      if (invitationResult.code === 'SIGNUP_DISABLED') {
        throw new InviteEmailError(
          'User registration is currently disabled. Please contact support.',
          data
        )
      }

      throw new InviteEmailError(
        invitationResult.error || `Failed to send invitation to ${member.email}`,
        data
      )
    } catch (invitationError) {
      if (isBillingUpgradeRequired(invitationError)) throw invitationError
      if (isInviteEmailError(invitationError)) throw invitationError
      const message =
        invitationError instanceof Error
          ? invitationError.message
          : `Failed to send invitation to ${member.email}`
      throw new InviteEmailError(message, data)
    }
  },
  
  async setMemberEnabled(siteId: string, memberId: string, enabled: boolean): Promise<SiteMember> {
    const response = await fetch(`/api/site-members/${encodeURIComponent(siteId)}/enabled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, enabled }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.success !== true) {
      const upgradeRequired = response.status === 402 ? parseBillingLimitError(result) : null
      if (upgradeRequired?.kind === 'members' && upgradeRequired.siteId === siteId) {
        throw new BillingUpgradeRequired(upgradeRequired)
      }
      throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to update member access')
    }
    const member = result.member
    if (!member || Array.isArray(member) || member.id !== memberId || member.site_id !== siteId) {
      throw new Error('Invalid member enabled response')
    }
    return member
  },

  // Update a member's details
  async updateMember(siteId: string, memberId: string, updates: Partial<SiteMemberInput>): Promise<SiteMember> {
    const response = await fetch(`/api/site-members/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId,
        role: updates.role,
        name: updates.name,
        position: updates.position,
        ...(updates.blocked_screens ? { blocked_screens: updates.blocked_screens } : {}),
        ...(updates.restrict_to_assigned_only !== undefined ? { restrict_to_assigned_only: updates.restrict_to_assigned_only } : {}),
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
      const errorMessage = result.error || 'Failed to update site member'
      if (errorMessage.includes('Cannot change role of the last admin or owner')) {
        throw new Error('Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.')
      }
      throw new Error(errorMessage)
    }

    return result.member
  },

  async updateBlockedScreens(
    siteId: string,
    memberId: string,
    blockedScreens: string[]
  ): Promise<SiteMember> {
    const response = await fetch(`/api/site-members/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId,
        blocked_screens: blockedScreens,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update blocked screens')
    }

    return result.member
  },
  
  // Remove a member from a site
  async removeMember(siteId: string, memberId: string): Promise<void> {
    const response = await fetch(`/api/site-members/${siteId}?memberId=${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
      const errorMessage = result.error || 'Failed to remove site member'
      if (errorMessage.includes('Cannot delete the last admin or owner')) {
        throw new Error('Cannot delete the last admin or owner of the site. At least one admin or owner must remain.')
      }
      throw new Error(errorMessage)
    }
  },
  
  // Invite a member by email (legacy method - now addMember handles invitations automatically)
  async inviteMember(siteId: string, siteName: string, member: SiteMemberInput): Promise<SiteMember> {
    return this.addMember(siteId, member, siteName)
  },
  
  // Manually activate pending memberships for a user (useful for existing users)
  async activateUserMemberships(userEmail: string): Promise<number> {
    const supabase = createClient()
    
    const { data, error } = await supabase.rpc('manually_activate_user_memberships', {
      user_email: userEmail
    })
    
    if (error) {
      console.error('Error activating user memberships:', error)
      throw new Error(`Failed to activate memberships: ${error.message}`)
    }
    
    return data || 0
  },
  
  // Check if there are pending invitations for an email
  async getPendingInvitations(email: string): Promise<SiteMember[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('site_members')
      .select('*, sites(name)')
      .eq('email', email)
      .eq('status', 'pending')
      .is('user_id', null)
    
    if (error) {
      console.error('Error fetching pending invitations:', error)
      throw new Error(`Failed to fetch pending invitations: ${error.message}`)
    }
    
    return data || []
  },
  
  async syncFromSettings(siteId: string, teamMembers: Array<{
    email: string
    role: 'view' | 'create' | 'delete' | 'admin'
    name?: string
    position?: string
  }>): Promise<void> {
    return syncSiteMembersFromSettings(this, siteId, teamMembers)
  },
}
