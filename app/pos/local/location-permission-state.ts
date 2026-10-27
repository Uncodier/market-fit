import { clearPosPrivateData, hasPosCachedSnapshot, lockPosDb, preparePosStorage, unlockPosDb } from "./db";

export const POS_PERMISSION_REFRESH_MS = 30_000;
export const POS_PERMISSION_TIMEOUT_MS = 8_000;
const OWNER_KEY = "pos-location-scope-v1";

export type PosPermissionScope = { userId: string; siteId: string; role: string };
export type PosPermissionLease = PosPermissionScope & { generation: number; expiresAt: number; offline?: boolean; remoteGeneration?: number };

let generation = 0;
let remoteGeneration = 0;
let lease: PosPermissionLease | null = null;
let deadline = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let mutations: Promise<unknown> = Promise.resolve();
const listeners = new Set<(reason?: "expired") => void>();

function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = mutations.then(action, action);
  mutations = result.catch(() => undefined);
  return result;
}

function ownerKey(scope: PosPermissionScope) {
  return JSON.stringify([scope.userId, scope.siteId, scope.role]);
}

export function subscribePosPermission(listener: (reason?: "expired") => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Unknown or revoked scope locks access without discarding unconfirmed work. */
export function suspendPosPermission(reason?: "expired") {
  clearTimeout(expiryTimer);
  deadline = 0;
  generation += 1;
  lease = null;
  lockPosDb();
  listeners.forEach((listener) => listener(reason));
}

export function getPosPermissionLease(siteId?: string): PosPermissionLease | null {
  if (!lease || (!lease.offline && (Date.now() >= lease.expiresAt || performance.now() >= deadline))) return null;
  if (siteId && siteId !== lease.siteId) return null;
  try { if (localStorage.getItem(OWNER_KEY) !== ownerKey(lease)) return null; } catch { return null; }
  return lease;
}

export function isPosPermissionCurrent(token: PosPermissionLease | null): boolean {
  return !!token && getPosPermissionLease(token.siteId)?.generation === token.generation;
}

export function requirePosPermission(siteId?: string): PosPermissionLease {
  const token = getPosPermissionLease(siteId);
  if (!token) throw new Error("POS requires verified access");
  return token;
}

/** Confirmed revocation/sign-out. Never replay another actor's unconfirmed queue. */
export function revokePosPermission(): Promise<void> {
  suspendPosPermission();
  return serialize(async () => {
    // Remove the marker first so a failed purge cannot make old rows trustworthy.
    localStorage.removeItem(OWNER_KEY);
    await clearPosPrivateData();
  });
}

/** Preparation is non-destructive; only verified access can replace cache ownership. */
export function preparePosPermission(userId: string | null, siteId: string | null): Promise<void> {
  suspendPosPermission();
  return serialize(async () => {
    // Test real writes, not just API presence, before touching any saved work.
    const probeKey = "pos-storage-probe-v1";
    const probe = JSON.stringify([userId, siteId, "collaborator"]);
    try {
      localStorage.setItem(probeKey, probe);
      if (localStorage.getItem(probeKey) !== probe) throw new Error("POS storage write could not be verified");
    } finally {
      localStorage.removeItem(probeKey);
    }
    await preparePosStorage();
  });
}

/** Restore only a previously verified scope with an atomically downloaded snapshot.
 * This grants local work, never remote replay. The server revalidates on reconnect.
 */
export function restorePosPermission(
  userId: string, siteId: string, isCurrent: () => boolean,
): Promise<PosPermissionLease | null> {
  return serialize(async () => {
    if (!isCurrent()) return null;
    const marker = localStorage.getItem(OWNER_KEY);
    let owner: unknown;
    try { owner = marker ? JSON.parse(marker) : null; } catch { return null; }
    if (!Array.isArray(owner) || owner.length !== 3 || owner[0] !== userId || owner[1] !== siteId ||
      !["owner", "admin", "collaborator", "marketing"].includes(owner[2])) return null;
    if (!await hasPosCachedSnapshot(siteId) || !isCurrent() || localStorage.getItem(OWNER_KEY) !== marker) return null;
    const previous = lease?.userId === userId && lease.siteId === siteId ? lease : null;
    lease = { userId, siteId, role: owner[2], generation: previous?.generation ?? ++generation,
      remoteGeneration: previous?.offline ? previous.remoteGeneration : ++remoteGeneration,
      expiresAt: Infinity, offline: true };
    clearTimeout(expiryTimer);
    const token = lease;
    unlockPosDb(() => isPosPermissionCurrent(token));
    return token;
  });
}

export function acceptPosPermission(
  scope: PosPermissionScope,
  isCurrent: () => boolean,
): Promise<PosPermissionLease | null> {
  return serialize(async () => {
    if (!isCurrent() || !navigator.onLine) return null;
    const key = ownerKey(scope);
    if (localStorage.getItem(OWNER_KEY) !== key) {
      suspendPosPermission();
      // An object is deliberately not a valid ownership grant. Reserve and verify
      // the actual marker write before purging, including browsers rejecting writes.
      const pending = JSON.stringify({ pending: key });
      localStorage.setItem(OWNER_KEY, pending);
      if (localStorage.getItem(OWNER_KEY) !== pending) throw new Error("POS storage write could not be verified");
      await clearPosPrivateData();
      if (!isCurrent() || !navigator.onLine || localStorage.getItem(OWNER_KEY) !== pending) return null;
      localStorage.setItem(OWNER_KEY, key);
      if (localStorage.getItem(OWNER_KEY) !== key) throw new Error("POS storage write could not be verified");
    }
    const previous = getPosPermissionLease(scope.siteId);
    if (!previous) lockPosDb();
    lease = { ...scope, generation: previous?.generation ?? ++generation,
      remoteGeneration: previous && !previous.offline ? previous.remoteGeneration : ++remoteGeneration,
      expiresAt: Date.now() + POS_PERMISSION_REFRESH_MS + POS_PERMISSION_TIMEOUT_MS };
    const token = lease;
    deadline = performance.now() + POS_PERMISSION_REFRESH_MS + POS_PERMISSION_TIMEOUT_MS;
    clearTimeout(expiryTimer);
    // Compare the issued lease, not the generation: a renewal retains its generation.
    // Neither a wall-clock rollback nor repeated hanging checks may extend this grant.
    expiryTimer = setTimeout(() => {
      if (lease === token) suspendPosPermission("expired");
    }, POS_PERMISSION_REFRESH_MS + POS_PERMISSION_TIMEOUT_MS);
    unlockPosDb(() => isPosPermissionCurrent(token));
    return lease;
  });
}