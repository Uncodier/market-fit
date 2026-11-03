import { v4 as uuidv4 } from "uuid";

const key = (siteId: string) => `pos-register-preflight:${siteId}`;

/** Synchronous cross-tab invalidation; storage events alone can arrive too late. */
export function readRegisterPreflightRevision(siteId: string): string | null {
  try {
    const revision = localStorage.getItem(key(siteId)) || "initial";
    return revision.startsWith("changing:") ? null : revision;
  } catch {
    // Unavailable storage disables reuse, not the authoritative register read.
    return null;
  }
}

/** Call only while holding the register lock. An ambiguous close invalidates too. */
export async function invalidateRegisterPreflightDuring<T>(siteId: string, operation: () => Promise<T>): Promise<T> {
  const token = uuidv4();
  const changing = `changing:${token}`;
  localStorage.setItem(key(siteId), changing);
  if (localStorage.getItem(key(siteId)) !== changing) throw new Error("Unable to coordinate register closing on this device.");
  try {
    return await operation();
  } finally {
    // If this write fails, the changing marker keeps all speculative reads unusable.
    // Do not replace the real close result with a cache-maintenance failure.
    try { localStorage.setItem(key(siteId), `ready:${token}`); } catch { /* Reuse remains disabled. */ }
  }
}