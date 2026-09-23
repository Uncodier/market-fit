"use client"

import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { SiteCapabilities } from "@/lib/permissions/types"

export function canManageVoiceChannel(
  capabilities: SiteCapabilities | null
): boolean {
  if (!capabilities) return false
  return (
    capabilities.is_owner ||
    capabilities.role === "owner" ||
    capabilities.role === "admin"
  )
}

export function useCanManageVoiceChannel(): boolean {
  const permissions = useOptionalPermissions()
  if (!permissions) return true
  return canManageVoiceChannel(permissions.capabilities)
}
