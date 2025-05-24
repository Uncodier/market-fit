import { useMemo } from 'react'

type TeamRole = "view" | "create" | "delete" | "admin"
type OriginalRole = 'owner' | 'admin' | 'marketing' | 'collaborator'

interface TeamMember {
  id?: string
  email: string
  role: TeamRole
  name?: string
  position?: string
  status?: 'pending' | 'active' | 'rejected'
  originalRole?: OriginalRole
}

interface TeamValidationResult {
  // Counts
  totalAdminsOwners: number
  totalDatabaseMembers: number
  
  // Member-specific functions
  isAdminOrOwner: (member: TeamMember) => boolean
  isLastAdminOwner: (member: TeamMember) => boolean
  canDelete: (member: TeamMember) => boolean
  canChangeRole: (member: TeamMember) => boolean
  
  // Validation messages
  getDeleteMessage: (member: TeamMember) => string
  getRoleChangeMessage: (member: TeamMember) => string
  getDeleteTooltip: (member: TeamMember) => string
}

export function useTeamMemberValidation(teamMembers: TeamMember[]): TeamValidationResult {
  return useMemo(() => {
    // Step 1: Filter only database members (those with ID)
    const databaseMembers = teamMembers.filter(member => member.id)
    
    // Step 2: Count admins and owners in database
    const adminsAndOwners = databaseMembers.filter(member => 
      member.originalRole === 'admin' || member.originalRole === 'owner'
    )
    
    const totalAdminsOwners = adminsAndOwners.length
    const totalDatabaseMembers = databaseMembers.length
    
    // Step 3: Helper functions
    const isAdminOrOwner = (member: TeamMember): boolean => {
      return member.originalRole === 'admin' || member.originalRole === 'owner'
    }
    
    const isLastAdminOwner = (member: TeamMember): boolean => {
      // Must be in database AND be admin/owner AND be the only one left
      return !!(
        member.id && 
        isAdminOrOwner(member) && 
        totalAdminsOwners === 1
      )
    }
    
    const canDelete = (member: TeamMember): boolean => {
      // Cannot delete if it's the last admin/owner
      return !isLastAdminOwner(member)
    }
    
    const canChangeRole = (member: TeamMember): boolean => {
      // Cannot change role if:
      // 1. It's the last admin/owner
      // 2. It's an owner (owners should stay owners)
      if (isLastAdminOwner(member)) return false
      if (member.originalRole === 'owner') return false
      return true
    }
    
    const getDeleteMessage = (member: TeamMember): string => {
      if (canDelete(member)) {
        return `Are you sure you want to remove ${member.name || member.email} from the team?`
      }
      
      const roleText = member.originalRole === 'owner' ? 'site owner' : 'site admin'
      const actionText = member.originalRole === 'owner' 
        ? 'You must transfer ownership to another member before removing the current owner.'
        : 'You must assign another team member as admin before removing this one.'
      
      return `Cannot remove ${member.name || member.email} because they are the last ${roleText}. ${actionText}`
    }
    
    const getRoleChangeMessage = (member: TeamMember): string => {
      if (member.originalRole === 'owner') {
        return 'Site owners cannot change their role'
      }
      if (isLastAdminOwner(member)) {
        return 'Last site admin - role cannot be changed'
      }
      return ''
    }
    
    const getDeleteTooltip = (member: TeamMember): string => {
      if (canDelete(member)) {
        return "Remove team member"
      }
      
      return member.originalRole === 'owner' 
        ? 'Cannot remove last site owner'
        : 'Cannot remove last site admin'
    }
    
    return {
      totalAdminsOwners,
      totalDatabaseMembers,
      isAdminOrOwner,
      isLastAdminOwner,
      canDelete,
      canChangeRole,
      getDeleteMessage,
      getRoleChangeMessage,
      getDeleteTooltip
    }
  }, [teamMembers])
} 