import type { SiteMember } from "@/app/services/site-members-service"

export type AssignableSiteMember = SiteMember & { user_id: string }

/** Members that can be assigned work: linked auth user, not rejected. */
export function assignableSiteMembers(members: SiteMember[]): AssignableSiteMember[] {
  const seen = new Set<string>()
  const result: AssignableSiteMember[] = []
  for (const member of members) {
    if (!member.user_id || member.status === "rejected") continue
    if (seen.has(member.user_id)) continue
    seen.add(member.user_id)
    result.push(member as AssignableSiteMember)
  }
  return result
}
