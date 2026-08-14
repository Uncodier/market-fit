export type SiteMemberRole = "owner" | "admin" | "collaborator" | "marketing"

export type PermissionCommand = "select" | "insert" | "update" | "delete"

export interface SiteCapabilities {
  role: SiteMemberRole | null
  is_owner: boolean
  select: boolean
  insert: boolean
  update: boolean
  delete: boolean
}

export const PERMISSION_DENIED_TITLE = "You don't have permission to do this"
