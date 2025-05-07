import { createClient } from '@/lib/supabase/client'

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
    
    return data || []
  },
  
  // Add a new member to a site
  async addMember(siteId: string, member: SiteMemberInput): Promise<SiteMember> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('site_members')
      .insert({
        site_id: siteId,
        email: member.email,
        role: member.role,
        name: member.name || null,
        position: member.position || null,
        added_by: userData.user?.id,
        status: 'pending'
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
      throw new Error(`Failed to remove site member: ${error.message}`)
    }
  },
  
  // Invite a member by email
  async inviteMember(siteId: string, siteName: string, member: SiteMemberInput): Promise<SiteMember> {
    // First add the member to the database
    const newMember = await this.addMember(siteId, member)
    
    try {
      // Call a server function to send the invitation email
      const supabase = createClient()
      await supabase.functions.invoke('send-member-invitation', {
        body: {
          siteId,
          siteName,
          memberEmail: member.email,
          memberName: member.name,
          memberRole: member.role
        }
      })
    } catch (error) {
      console.error('Error sending invitation email:', error)
      // We don't throw here because the member was added successfully
      // The user can resend the invitation later if needed
    }
    
    return newMember
  },
  
  // Sync team members from settings to site_members
  async syncFromSettings(siteId: string, teamMembers: Array<{
    email: string,
    role: 'view' | 'create' | 'delete' | 'admin',
    name?: string,
    position?: string
  }>): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    
    if (!userData.user) {
      throw new Error('Not authenticated')
    }
    
    // First get current site members to check for removals
    const { data: currentMembers, error: membersError } = await supabase
      .from('site_members')
      .select('id, email, role')
      .eq('site_id', siteId)
      .not('role', 'eq', 'owner') // Don't touch the owner
    
    if (membersError) {
      console.error('Error fetching current site members:', membersError)
      throw new Error(`Failed to sync members: ${membersError.message}`)
    }
    
    // 1. Create new members
    for (const member of teamMembers) {
      if (!member.email) continue;
      
      const existingMember = currentMembers?.find((m: ExistingSiteMember) => m.email === member.email)
      
      const siteMemberRole = mapTeamRoleToSiteMemberRole(member.role)
      
      if (!existingMember) {
        // It's a new member, insert it
        const { error } = await supabase
          .from('site_members')
          .insert({
            site_id: siteId,
            email: member.email,
            role: siteMemberRole,
            name: member.name || null,
            position: member.position || null,
            added_by: userData.user.id,
            status: 'pending' // All new members start as pending
          })
        
        if (error && error.code !== '23505') { // Ignore unique constraint violation
          console.error('Error adding new site member during sync:', error)
        }
      } else {
        // Update existing member if needed
        if (existingMember.role !== siteMemberRole || 
            (member.name && existingMember.role !== siteMemberRole)) {
          const { error } = await supabase
            .from('site_members')
            .update({
              role: siteMemberRole,
              name: member.name || null,
              position: member.position || null
            })
            .eq('id', existingMember.id)
          
          if (error) {
            console.error('Error updating site member during sync:', error)
          }
        }
      }
    }
    
    // 2. Remove members that are not in the new list
    if (currentMembers) {
      const currentEmails = currentMembers.map((m: ExistingSiteMember) => m.email)
      const newEmails = teamMembers.map(m => m.email)
      
      const emailsToRemove = currentEmails.filter((email: string) => !newEmails.includes(email))
      
      if (emailsToRemove.length > 0) {
        const { error } = await supabase
          .from('site_members')
          .delete()
          .eq('site_id', siteId)
          .in('email', emailsToRemove)
        
        if (error) {
          console.error('Error removing site members during sync:', error)
        }
      }
    }
  }
} 