import type { SiteMember } from "@/app/services/site-members-service"

export type AssignableSiteMember = SiteMember & { user_id: string }

/** Suspended memberships cannot receive new assignments. */
export function assignableSiteMembers(members: SiteMember[]): AssignableSiteMember[] {
  const seen = new Set<string>()
  const result: AssignableSiteMember[] = []
  for (const member of members) {
    if (!member.user_id || member.status === "rejected" || member.license_suspended) continue
    if (seen.has(member.user_id)) continue
    seen.add(member.user_id)
    result.push(member as AssignableSiteMember)
  }
  return result
}
