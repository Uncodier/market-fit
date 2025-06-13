import { createClient } from '@/lib/supabase/client'
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
  emailConfirmed?: boolean // Track if user has confirmed their email
  lastSignIn?: string // Track last sign in to know if user is truly active
}

export interface SiteMemberInput {
  email: string
  role: 'admin' | 'marketing' | 'collaborator'
  name?: string
  position?: string
}

// For existing members fetched from the database
interface ExistingSiteMember {
  id: string
  email: string
  role: string
  name?: string | null
  position?: string | null
}

const mapTeamRoleToSiteMemberRole = (role: 'view' | 'create' | 'delete' | 'admin'): 'collaborator' | 'marketing' | 'admin' => {
  switch(role) {
    case 'view': return 'collaborator';
    case 'create': 
    case 'delete': 
      return 'marketing';
    case 'admin': return 'admin';
    default: return 'collaborator';
  }
}

export const siteMembersService = {
  // Get all members for a site
  async getMembers(siteId: string): Promise<SiteMember[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('site_members')
      .select('*')
      .eq('site_id', siteId)
      .order('role', { ascending: false })
    
    if (error) {
      console.error('Error fetching site members:', error)
      throw new Error(`Failed to fetch site members: ${error.message}`)
    }
    
    // For each member, get their email confirmation status from auth.users
    const membersWithStatus = await Promise.all((data || []).map(async (member: any) => {
      if (!member.user_id) {
        // User hasn't been created yet, so email is not confirmed
        return {
          ...member,
          emailConfirmed: false,
          lastSignIn: null
        }
      }
      
      try {
        // Get user info from auth.users via admin API
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(member.user_id)
        
        if (userError || !user) {
          console.warn(`Could not fetch user info for user_id ${member.user_id}:`, userError)
          return {
            ...member,
            emailConfirmed: false,
            lastSignIn: null
          }
        }
        
        return {
          ...member,
          emailConfirmed: !!user.email_confirmed_at,
          lastSignIn: user.last_sign_in_at
        }
      } catch (err) {
        console.warn(`Error fetching user status for ${member.email}:`, err)
        return {
          ...member,
          emailConfirmed: false,
          lastSignIn: null
        }
      }
    }))
    
    return membersWithStatus
  },
  
  // Add a new member to a site
  async addMember(siteId: string, member: SiteMemberInput): Promise<SiteMember> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    
    // Check if the user already exists in auth.users
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', member.email)
      .single();
    
    const { data, error } = await supabase
      .from('site_members')
      .insert({
        site_id: siteId,
        user_id: existingUser?.id || null, // NULL for users that don't exist yet
        email: member.email,
        role: member.role,
        name: member.name || null,
        position: member.position || null,
        added_by: userData.user?.id,
        status: existingUser?.id ? 'active' : 'pending' // 'active' if user exists, 'pending' otherwise
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error adding site member:', error)
      // If it's a duplicate error, provide a more friendly message
      if (error.code === '23505') {
        throw new Error(`This email is already a member of this site`)
      }
      throw new Error(`Failed to add site member: ${error.message}`)
    }
    
    // After successfully creating the site member, send magic link invitation
    try {
      // Get site information for the invitation
      const { data: siteData } = await supabase
        .from('sites')
        .select('name')
        .eq('id', siteId)
        .single();
      
      const siteName = siteData?.name || 'Your Site';
      
      // Map site_member role to invitation role for magic link
      let invitationRole: string = 'view';
      switch (member.role) {
        case 'admin': invitationRole = 'admin'; break;
        case 'marketing': invitationRole = 'create'; break;
        case 'collaborator': invitationRole = 'view'; break;
        default: invitationRole = 'view'; break;
      }
      
      // Send magic link invitation
      const invitationResult = await sendMagicLinkInvitation({
        email: member.email,
        siteId: siteId,
        siteName: siteName,
        role: invitationRole,
        name: member.name,
        position: member.position
      });
      
      if (invitationResult.success) {
        console.log(`Magic link invitation sent successfully to ${member.email}`);
      } else {
        console.warn(`Failed to send magic link invitation to ${member.email}:`, invitationResult.error);
        
        // For rate limit errors, we want to propagate this to the user
        if (invitationResult.code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error(`Rate limit exceeded for ${member.email}. Please wait ${invitationResult.retryAfter || 60} seconds before trying again.`);
        }
        
        // For other critical errors, also propagate
        if (invitationResult.code === 'SIGNUP_DISABLED') {
          throw new Error('User registration is currently disabled. Please contact support.');
        }
        
        // For other errors, log but don't fail the operation
        // Note: We don't throw an error here because the site member was created successfully
        // The invitation failure is logged but doesn't affect the main operation
      }
      
    } catch (invitationError) {
      console.warn('Error sending magic link invitation:', invitationError);
      // Again, we log the error but don't throw it since the main operation succeeded
    }
    
    return data
  },
  
  // Update a member's details
  async updateMember(memberId: string, updates: Partial<SiteMemberInput>): Promise<SiteMember> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('site_members')
      .update({
        role: updates.role,
        name: updates.name,
        position: updates.position
      })
      .eq('id', memberId)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating site member:', error)
      
      // Check if it's the trigger preventing role change of last admin
      if (error.message?.includes('Cannot change role of the last admin or owner')) {
        throw new Error('Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.')
      }
      
      throw new Error(`Failed to update site member: ${error.message}`)
    }
    
    return data
  },
  
  // Remove a member from a site
  async removeMember(memberId: string): Promise<void> {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('site_members')
      .delete()
      .eq('id', memberId)
    
    if (error) {
      console.error('Error removing site member:', error)
      
      // Check if it's the trigger preventing deletion of last admin
      if (error.message?.includes('Cannot delete the last admin or owner')) {
        throw new Error('Cannot delete the last admin or owner of the site. At least one admin or owner must remain.')
      }
      
      throw new Error(`Failed to remove site member: ${error.message}`)
    }
  },
  
  // Invite a member by email (legacy method - now addMember handles invitations automatically)
  async inviteMember(siteId: string, siteName: string, member: SiteMemberInput): Promise<SiteMember> {
    // This method now just calls addMember since invitations are sent automatically
    return this.addMember(siteId, member)
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