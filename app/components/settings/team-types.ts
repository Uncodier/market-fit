import type { SiteMember } from "@/app/services/site-members-service"
import { siteMemberRoleToInvitationRole } from "@/lib/auth/screen-access"

export type TeamRole = "view" | "create" | "delete" | "admin"

export interface FormTeamMember {
  name?: string
  email: string
  role: TeamRole
  position?: string
  id?: string
  status?: "pending" | "active" | "rejected"
  originalRole?: "owner" | "admin" | "marketing" | "collaborator"
  emailConfirmed?: boolean
  lastSignIn?: string
  blocked_screens?: string[]
  restrict_to_assigned_only?: boolean
}

export const TEAM_ROLES: {
  value: TeamRole
  label: string
  description: string
}[] = [
  { value: "view", label: "Viewer", description: "View only" },
  { value: "create", label: "Editor", description: "Create and edit" },
  { value: "delete", label: "Manager", description: "Full access" },
  { value: "admin", label: "Admin", description: "Owner privileges" },
]

export function screensEqual(a?: string[], b?: string[]): boolean {
  return [...(a || [])].sort().join(",") === [...(b || [])].sort().join(",")
}

export function getMemberInitials(name?: string, email?: string): string {
  const fromName = (name || "").trim()
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  const fromEmail = (email || "").trim()
  if (fromEmail) return fromEmail.slice(0, 2).toUpperCase()
  return "?"
}

export function siteMemberToFormMember(member: SiteMember): FormTeamMember {
  let formRole: TeamRole = "view"
  switch (member.role) {
    case "admin":
    case "owner":
      formRole = "admin"
      break
    case "collaborator":
      formRole = "create"
      break
    case "marketing":
      formRole = "view"
      break
  }

  return {
    id: member.id,
    name: member.name || undefined,
    email: member.email,
    role: formRole,
    position: member.position || undefined,
    status: member.status,
    originalRole: member.role,
    emailConfirmed: member.emailConfirmed,
    lastSignIn: member.lastSignIn,
    blocked_screens: member.blocked_screens || [],
    restrict_to_assigned_only: member.restrict_to_assigned_only || false,
  }
}

export function formRoleToSiteMemberRole(
  role: TeamRole
): "admin" | "collaborator" | "marketing" {
  if (role === "admin") return "admin"
  if (role === "create" || role === "delete") return "collaborator"
  return "marketing"
}

export function formRoleToInvitationRole(role: TeamRole): string {
  return siteMemberRoleToInvitationRole(formRoleToSiteMemberRole(role))
}

export function membersToOriginalMap(members: FormTeamMember[]) {
  const map = new Map<string, FormTeamMember>()
  members.forEach((member) => {
    if (member.id) map.set(member.id, { ...member })
  })
  return map
}

export function isPendingInvitation(member: FormTeamMember): boolean {
  return (
    member.status === "pending" &&
    !!member.id &&
    (!member.emailConfirmed || !member.lastSignIn)
  )
}

export function isValidTeamEmail(email: string | undefined): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
