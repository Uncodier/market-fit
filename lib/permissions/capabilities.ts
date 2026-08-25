import type { PermissionCommand, SiteCapabilities, SiteMemberRole } from "./types"

const ALLOW_ALL: SiteCapabilities = {
  role: null,
  is_owner: false,
  select: true,
  insert: true,
  update: true,
  delete: true,
}

export function capabilitiesFromRole(role: SiteMemberRole | null): SiteCapabilities {
  if (!role) {
    return {
      role: null,
      is_owner: false,
      select: false,
      insert: false,
      update: false,
      delete: false,
    }
  }

  const canWrite = role === "owner" || role === "admin" || role === "collaborator"
  const canDelete = role === "owner" || role === "admin"
  return {
    role,
    is_owner: role === "owner",
    select: true,
    insert: canWrite,
    update: canWrite,
    delete: canDelete,
  }
}

export function commandAllowed(
  capabilities: SiteCapabilities | null | undefined,
  command: PermissionCommand
): boolean {
  if (!capabilities) return true
  if (capabilities.is_owner) return true
  return !!capabilities[command]
}

function unwrapCapabilitiesPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (typeof data === "string") {
    try {
      return unwrapCapabilitiesPayload(JSON.parse(data))
    } catch {
      return null
    }
  }
  if (Array.isArray(data)) {
    return data.length > 0 ? unwrapCapabilitiesPayload(data[0]) : null
  }
  if (typeof data !== "object") return null
  const value = data as Record<string, unknown>
  if (value.get_my_site_capabilities != null && typeof value.role === "undefined") {
    return unwrapCapabilitiesPayload(value.get_my_site_capabilities)
  }
  return value
}

export function parseCapabilities(data: unknown): SiteCapabilities | null {
  const value = unwrapCapabilitiesPayload(data)
  if (!value) return null
  const parsedRole = parseRole(value.role)
  const isOwner = value.is_owner === true || parsedRole === "owner"
  const role: SiteMemberRole | null = isOwner ? "owner" : parsedRole
  return {
    ...capabilitiesFromRole(role),
    role,
    is_owner: isOwner,
  }
}

function parseRole(value: unknown): SiteMemberRole | null {
  if (value === "owner" || value === "admin" || value === "collaborator" || value === "marketing") {
    return value
  }
  return null
}

type PermissionStore = {
  siteId: string | null
  capabilities: SiteCapabilities | null
  loaded: boolean
}

let store: PermissionStore = {
  siteId: null,
  capabilities: null,
  loaded: false,
}

export function setPermissionStore(next: PermissionStore) {
  store = next
}

export function getPermissionStore(): PermissionStore {
  return store
}

export function resetPermissionStore() {
  store = { siteId: null, capabilities: null, loaded: false }
}

/** Fail-open when capabilities are unknown so a failed RPC does not freeze the app. */
export function canCommand(command: PermissionCommand): boolean {
  if (!store.siteId || !store.loaded || !store.capabilities) return true
  return commandAllowed(store.capabilities, command)
}

export function getFailOpenCapabilities(): SiteCapabilities {
  return ALLOW_ALL
}
