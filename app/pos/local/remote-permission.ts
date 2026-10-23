import { getPosPermissionLease, isPosPermissionCurrent, requirePosPermission, type PosPermissionLease } from "./location-permission-state";

/** Local continuity is not permission to start or resume remote work. */
export function canStartPosRemoteRequest(permission: PosPermissionLease | null): boolean {
  if (!permission || permission.offline || !isPosPermissionCurrent(permission) ||
    typeof navigator === "undefined" || !navigator.onLine) return false;
  const current = getPosPermissionLease(permission.siteId);
  return !!current && !current.offline && current.remoteGeneration === permission.remoteGeneration;
}

export class PosRemoteAccessUnavailableError extends Error {
  constructor() {
    super("Connect and verify POS access before starting this operation. Local orders remain available.");
    this.name = "PosRemoteAccessUnavailableError";
  }
}

export function assertPosRemotePermission(permission: PosPermissionLease): void {
  if (!canStartPosRemoteRequest(permission)) throw new PosRemoteAccessUnavailableError();
}

export function requirePosRemotePermission(siteId?: string): PosPermissionLease {
  const permission = requirePosPermission(siteId);
  assertPosRemotePermission(permission);
  return permission;
}