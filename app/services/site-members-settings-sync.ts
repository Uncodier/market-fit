import type { SiteMember, SiteMemberInput } from './site-members-service'

interface SettingsMember {
  email: string
  role: 'view' | 'create' | 'delete' | 'admin'
  name?: string
  position?: string
}

interface MemberService {
  getMembers(siteId: string): Promise<SiteMember[]>
  addMember(siteId: string, member: SiteMemberInput): Promise<SiteMember>
  updateMember(siteId: string, memberId: string, updates: Partial<SiteMemberInput>): Promise<SiteMember>
  removeMember(siteId: string, memberId: string): Promise<void>
}

/** Legacy settings sync uses the same authorized, licensed API as the team editor. */
export async function syncSiteMembersFromSettings(service: MemberService, siteId: string, team: SettingsMember[]): Promise<void> {
  const existing = (await service.getMembers(siteId)).filter(member => member.role !== 'owner')
  const desired = team.filter(member => member.email?.trim()).map(member => ({
    ...member,
    email: member.email.trim().toLowerCase(),
    role: (member.role === 'admin' ? 'admin' : member.role === 'view' ? 'marketing' : 'collaborator') as SiteMemberInput['role'],
  }))
  for (const member of desired) {
    const current = existing.find(row => row.email.trim().toLowerCase() === member.email)
    if (!current) await service.addMember(siteId, member)
    else if (current.role !== member.role || current.name !== (member.name || null) || current.position !== (member.position || null)) {
      await service.updateMember(siteId, current.id, member)
    }
  }
  for (const current of existing) {
    if (!desired.some(member => member.email === current.email.trim().toLowerCase())) {
      await service.removeMember(siteId, current.id)
    }
  }
}