import { createClient } from '@/lib/supabase/client'
import { siteMemberRoleToInvitationRole } from '@/lib/auth/screen-access'
import { assignableSiteMembers } from '@/lib/auth/assignable-site-members'
import { sendMagicLinkInvitation } from './magic-link-invitation-service'

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
  blocked_screens?: string[]
  emailConfirmed?: boolean // Track if user has confirmed their email
  lastSignIn?: string // Track last sign in to know if user is truly active
}

export interface SiteMemberInput {
  email: string
  role: 'admin' | 'marketing' | 'collaborator'
  name?: string
  position?: string
  blocked_screens?: string[]
}

// For existing members fetched from the database
interface ExistingSiteMember {
  id: string
  email: string
  role: string
  name?: string | null
  position?: string | null
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

const mapTeamRoleToSiteMemberRole = (role: 'view' | 'create' | 'delete' | 'admin'): 'collaborator' | 'marketing' | 'admin' => {
  switch(role) {
    case 'view': return 'marketing';  // Viewer role -> SELECT only
    case 'create': 
    case 'delete': 
      return 'collaborator';         // Editor role -> SELECT, INSERT, UPDATE
    case 'admin': return 'admin';    // Admin role -> SELECT, INSERT, UPDATE
    default: return 'marketing';     // Default to viewer
  }
}

export const siteMembersService = {
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
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
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
      if (isInviteEmailError(invitationError)) throw invitationError
      const message =
        invitationError instanceof Error
          ? invitationError.message
          : `Failed to send invitation to ${member.email}`
      throw new InviteEmailError(message, data)
    }
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
  
  // Sync team members from settings to site_members
  async syncFromSettings(siteId: string, teamMembers: Array<{
    email: string,
    role: 'view' | 'create' | 'delete' | 'admin',
    name?: string,
    position?: string
  }>): Promise<void> {
    console.log('🔄 SYNC: Starting syncFromSettings for siteId:', siteId);
    console.log('🔄 SYNC: Team members to sync:', teamMembers);
    
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    
    if (!userData.user) {
      console.error('❌ SYNC: Not authenticated');
      throw new Error('Not authenticated')
    }
    
    console.log('✅ SYNC: User authenticated:', userData.user.id);
    
    // First get current site members to check for removals
    const { data: currentMembers, error: membersError } = await supabase
      .from('site_members')
      .select('id, email, role')
      .eq('site_id', siteId)
      .not('role', 'eq', 'owner') // Don't touch the owner
    
    if (membersError) {
      console.error('❌ SYNC: Error fetching current site members:', membersError)
      throw new Error(`Failed to sync members: ${membersError.message}`)
    }
    
    console.log('📋 SYNC: Current site members:', currentMembers);
    
    // 1. Create new members
    for (const member of teamMembers) {
      if (!member.email) {
        console.log('⚠️ SYNC: Skipping member with empty email');
        continue;
      }
      
      console.log(`🔍 SYNC: Processing member: ${member.email}`);
      
      const existingMember = currentMembers?.find((m: ExistingSiteMember) => m.email === member.email)
      
      const siteMemberRole = mapTeamRoleToSiteMemberRole(member.role)
      console.log(`🔄 SYNC: Role mapping ${member.role} -> ${siteMemberRole}`);
      
      if (!existingMember) {
        console.log(`➕ SYNC: Member ${member.email} not found in site_members, creating new record`);
        
        // Check if the user exists in auth.users
        const { data: existingUser, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', member.email)
          .single();
        
        if (userError && userError.code !== 'PGRST116') {
          console.error(`❌ SYNC: Error checking if user exists for ${member.email}:`, userError);
        }
        
        console.log(`👤 SYNC: User ${member.email} exists in auth: ${!!existingUser} (user_id: ${existingUser?.id || 'null'})`);
        
        // It's a new member, insert it
        const insertData = {
          site_id: siteId,
          user_id: existingUser?.id || null, // Explicitly NULL for pending users
          email: member.email,
          role: siteMemberRole,
          name: member.name || null,
          position: member.position || null,
          added_by: userData.user.id,
          status: existingUser?.id ? 'active' : 'pending' // Active if user exists, pending otherwise
        };
        
        console.log(`📝 SYNC: Inserting site_member with data:`, insertData);
        console.log(`🔐 SYNC: Current user auth.uid(): ${userData.user.id}`);
        console.log(`🏢 SYNC: Site ID: ${siteId}`);
        
        // First, let's check if the user has permission to insert into this site
        const { data: permissionCheck, error: permissionError } = await supabase
          .from('sites')
          .select('id, user_id')
          .eq('id', siteId)
          .single();
        
        if (permissionError) {
          console.error(`❌ SYNC: Error checking site ownership:`, permissionError);
        } else {
          console.log(`🔍 SYNC: Site ownership check:`, permissionCheck);
          console.log(`🔍 SYNC: User is site owner: ${permissionCheck?.user_id === userData.user.id}`);
        }
        
        // Check if there's already a site_member with this email
        const { data: existingByEmail, error: emailCheckError } = await supabase
          .from('site_members')
          .select('id, email, status')
          .eq('site_id', siteId)
          .eq('email', member.email)
          .maybeSingle();
        
        if (emailCheckError) {
          console.error(`❌ SYNC: Error checking existing email:`, emailCheckError);
        } else if (existingByEmail) {
          console.log(`⚠️ SYNC: Member with email ${member.email} already exists:`, existingByEmail);
          continue; // Skip this member as it already exists
        } else {
          console.log(`✅ SYNC: No existing member found with email ${member.email}`);
        }
        
        const { data: insertResult, error } = await supabase
          .from('site_members')
          .insert(insertData)
          .select()
        
        if (error) {
          console.error(`❌ SYNC: Error adding new site member during sync for ${member.email}:`, error)
          console.error(`❌ SYNC: Error code: ${error.code}`);
          console.error(`❌ SYNC: Error message: ${error.message}`);
          console.error(`❌ SYNC: Error details:`, error.details);
          console.error(`❌ SYNC: Error hint:`, error.hint);
          console.error(`❌ SYNC: Full error object:`, JSON.stringify(error, null, 2));
          
          // Also log the current auth context
          console.error(`❌ SYNC: Current auth context:`, {
            userId: userData.user.id,
            userEmail: userData.user.email,
            siteId: siteId,
            insertData: insertData
          });
          
          // Log more details about the error
          if (error.code === '23505') {
            console.log('🔄 SYNC: Duplicate entry detected - this is normal if member already exists');
          } else if (error.code === '23503') {
            console.log('🔗 SYNC: Foreign key constraint violation - check user_id');
          } else if (error.code === '42501') {
            console.log('🔐 SYNC: Insufficient privileges - RLS policy rejection');
          } else if (error.code === 'PGRST301') {
            console.log('🔐 SYNC: RLS policy violation - INSERT operation not allowed');
          } else {
            console.error('💥 SYNC: Unexpected error:', error.message);
          }
          
          // Don't throw here, continue with other members
          continue;
        } else {
          console.log(`✅ SYNC: Successfully created site_member for ${member.email}:`, insertResult);
        }
      } else {
        console.log(`🔄 SYNC: Member ${member.email} already exists in site_members, checking if update is needed`);
        
        // Update existing member if needed
        if (existingMember.role !== siteMemberRole || 
            (member.name && existingMember.name !== member.name) ||
            (member.position && existingMember.position !== member.position)) {
          
          console.log(`📝 SYNC: Updating existing member ${member.email}`);
          
          const { error } = await supabase
            .from('site_members')
            .update({
              role: siteMemberRole,
              name: member.name || null,
              position: member.position || null
            })
            .eq('id', existingMember.id)
          
          if (error) {
            console.error(`❌ SYNC: Error updating site member during sync for ${member.email}:`, error)
          } else {
            console.log(`✅ SYNC: Successfully updated member ${member.email}`);
          }
        } else {
          console.log(`⏭️ SYNC: No changes needed for member ${member.email}`);
        }
      }
    }
    
    // 2. Remove members that are not in the new list
    if (currentMembers) {
      const currentEmails = currentMembers.map((m: ExistingSiteMember) => m.email)
      const newEmails = teamMembers.map(m => m.email)
      
      const emailsToRemove = currentEmails.filter((email: string) => !newEmails.includes(email))
      
      if (emailsToRemove.length > 0) {
        console.log(`🗑️ SYNC: Removing members no longer in team_members:`, emailsToRemove);
        
        const { error } = await supabase
          .from('site_members')
          .delete()
          .eq('site_id', siteId)
          .in('email', emailsToRemove)
        
        if (error) {
          console.error('❌ SYNC: Error removing site members during sync:', error)
        } else {
          console.log(`✅ SYNC: Successfully removed ${emailsToRemove.length} members`);
        }
      } else {
        console.log('📝 SYNC: No members to remove');
      }
    }
    
    console.log('🎉 SYNC: syncFromSettings completed successfully');
  }
} 