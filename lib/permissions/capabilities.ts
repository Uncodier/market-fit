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
  return {
    role,
    is_owner: role === "owner",
    select: true,
    insert: canWrite,
    update: canWrite,
    delete: role === "owner",
  }
}

export function parseCapabilities(data: unknown): SiteCapabilities | null {
  if (!data || typeof data !== "object") return null
  const value = data as Record<string, unknown>
  const role = parseRole(value.role)
  return {
    role,
    is_owner: value.is_owner === true || role === "owner",
    select: value.select !== false,
    insert: value.insert === true,
    update: value.update === true,
    delete: value.delete === true,
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
  return !!store.capabilities[command]
}

export function getFailOpenCapabilities(): SiteCapabilities {
  return ALLOW_ALL
}
