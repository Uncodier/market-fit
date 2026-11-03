import type { PosPermissionLease } from "./location-permission-state";
import type { PosOutboxRow } from "./types";

const RETRY_MIN_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

/** Scheduling evidence only: never authorizes or retries a checkout mutation. */
export class CatalogRefreshState {
  private observations = new Map<string, { scope: string; rows: Map<string, boolean> }>();
  private retries = new Map<string, { delay: number; after: number }>();

  observe(permission: PosPermissionLease, rows: PosOutboxRow[]): boolean {
    const scope = JSON.stringify([permission.userId, permission.role]);
    let state = this.observations.get(permission.siteId);
    if (state?.scope !== scope) {
      state = { scope, rows: new Map() };
      this.observations.set(permission.siteId, state);
    }
    let confirmed = false;
    for (const row of rows) {
      if (row.siteId !== permission.siteId || row.kind !== "checkout" || row.payload.kind !== "checkout" ||
        row.payload.data.siteId !== permission.siteId || row.payload.data.userId !== permission.userId) continue;
      const key = JSON.stringify([row.id, row.clientMutationId]);
      const previous = state.rows.get(key);
      const synced = row.status === "synced";
      if (previous === false && synced) confirmed = true;
      // Concurrent queue reads can finish out of order. Confirmation is monotonic;
      // a stale pending snapshot must not re-arm an already consumed transition.
      state.rows.set(key, previous === true || synced);
    }
    return confirmed;
  }

  canRetry(siteId: string, now = Date.now()): boolean {
    return now >= (this.retries.get(siteId)?.after ?? 0);
  }

  failed(siteId: string) {
    const delay = Math.min((this.retries.get(siteId)?.delay ?? 0) * 2 || RETRY_MIN_MS, RETRY_MAX_MS);
    this.retries.set(siteId, { delay, after: Date.now() + delay });
  }

  succeeded(siteId: string) { this.retries.delete(siteId); }
  resetCooldowns() { this.retries.clear(); }
}