import { getPosDb } from "./db";
import { updateOutboxRow } from "./outbox";
import { applyOutboxItem } from "./sync-outbox-item";
import { syncCheckoutDependencies } from "./sync-checkout-dependencies";
import { applyPosCheckoutRecovery, reconcilePosCheckout } from "./checkout-recovery";
import { PosCheckoutRecoveryError } from "../checkout-recovery-types";
import { clearPosSyncError, recordPosSyncError } from "./sync-errors";
import { isPosPermissionCurrent, type PosPermissionLease } from "./location-permission-state";
import type { PosOutboxRow } from "./types";

const SYNC_WAIT_MS = 45_000;
const RECOVERY_WAIT_MS = 8_000;
type Flight = { siteId: string; wait: Promise<void> };
// A deadline bounds the caller's wait, not the Server Action's lifetime. Never
// release ownership on timeout or permission reset: the request may still commit.
const inFlight = new Map<string, Flight>();

export function hasPosOutboxWork(siteId: string): boolean {
  return Array.from(inFlight.values()).some((flight) => flight.siteId === siteId);
}

function hasCollectedPayment(row: PosOutboxRow): boolean {
  return row.payload.kind === "checkout" && !!row.payload.data.payments?.length;
}

async function recordFailure(row: PosOutboxRow, permission: PosPermissionLease, message: string, submitted: boolean) {
  if (!isPosPermissionCurrent(permission)) return;
  const db = getPosDb();
  await db.transaction("rw", db.outbox, async () => {
    const current = await db.outbox.get(row.id);
    // A timeout can race a successful response or manual evidence lookup.
    if (!current || current.status === "synced" || !isPosPermissionCurrent(permission)) return;
    await updateOutboxRow(row.id, { ...(submitted ? { status: "failed" as const } : {}), lastError: message });
    recordPosSyncError(`outbox:${row.id}`, {
      siteId: row.siteId, operation: row.kind, error: message,
      clientMutationId: row.clientMutationId, attempts: current.attempts,
    });
  });
}

/** One real request per row across background and targeted callers. */
export function syncPosOutboxRow(
  queued: PosOutboxRow,
  permission: PosPermissionLease,
  changed: (siteId: string) => void,
  ancestors = new Set<string>(),
): Promise<void> {
  if (ancestors.has(queued.id)) return Promise.reject(new Error("Cyclic local checkout dependency"));
  const key = JSON.stringify([queued.siteId, queued.id]);
  const active = inFlight.get(key);
  if (active) return active.wait;

  let row = queued;
  let submitted = false;
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  let releaseWait!: () => void;
  const deadline = Date.now() + SYNC_WAIT_MS;
  const isExpired = () => expired || Date.now() >= deadline;
  const timedOut = new Promise<void>((resolve) => { releaseWait = resolve; });
  const armDeadline = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      expired = true;
      void recordFailure(row, permission, "Sync timed out", submitted)
        .catch(() => { /* An unavailable local store cannot prove a failed checkout. */ })
        .finally(() => { changed(row.siteId); releaseWait(); });
    }, Math.max(0, Math.min(ms, deadline - Date.now())));
  };
  armDeadline(SYNC_WAIT_MS);

  const request = Promise.resolve().then(async () => {
    const current = await getPosDb().outbox.get(queued.id);
    if (!current || isExpired() || !isPosPermissionCurrent(permission)) return;
    row = current;
    if (row.siteId !== permission.siteId || row.payload.data.siteId !== permission.siteId) {
      await recordFailure(row, permission, "POS site changed", true);
      return;
    }
    if (row.payload.kind === "checkout" && row.payload.data.userId !== permission.userId) {
      await recordFailure(row, permission, "POS account changed", true);
      return;
    }
    if (row.status === "synced" || row.recoveryState === "rejected") return;

    const recover = async () => {
      armDeadline(RECOVERY_WAIT_MS);
      try {
        const result = await reconcilePosCheckout(row.siteId, row.id);
        if (isPosPermissionCurrent(permission) && result.state === "completed") {
          clearPosSyncError(row.siteId, `outbox:${row.id}`);
        }
      } catch { /* A failed evidence read never authorizes another collection. */ }
    };
    if (hasCollectedPayment(row) && (row.status !== "pending" || row.recoveryState)) {
      submitted = true;
      await recover();
      return;
    }
    if (row.recoveryState) return;

    try {
      const chain = new Set(ancestors).add(row.id);
      await syncCheckoutDependencies(row, permission, (dependency) => {
        if (isExpired()) throw new Error("Sync timed out");
        return syncPosOutboxRow(dependency, permission, changed, chain);
      });
      if (isExpired() || !isPosPermissionCurrent(permission)) return;
      // Dependencies may have taken time; never replay a newly confirmed row.
      const latest = await getPosDb().outbox.get(row.id);
      if (!latest || latest.status === "synced" || isExpired() || !isPosPermissionCurrent(permission)) return;
      if (hasCollectedPayment(latest) && (latest.status !== "pending" || latest.recoveryState)) {
        submitted = true;
        await recover();
        return;
      }
      await updateOutboxRow(row.id, { status: "syncing", attempts: latest.attempts + 1 });
      if (!isPosPermissionCurrent(permission)) return;
      if (isExpired()) {
        // The local claim itself may have stalled. No request was dispatched.
        const db = getPosDb();
        await db.transaction("rw", db.outbox, async () => {
          const current = await db.outbox.get(row.id);
          if (current?.status === "syncing" && !current.recoveryState && isPosPermissionCurrent(permission)) {
            await updateOutboxRow(row.id, { status: latest.status, attempts: latest.attempts });
          }
        });
        return;
      }
      submitted = true;
      await applyOutboxItem(row, permission);
      if (isPosPermissionCurrent(permission)) clearPosSyncError(row.siteId, `outbox:${row.id}`);
    } catch (error) {
      if (!isPosPermissionCurrent(permission)) return;
      await recordFailure(row, permission, error instanceof Error ? error.message : "Sync failed", submitted);
      if (!submitted) return;
      if (error instanceof PosCheckoutRecoveryError) await applyPosCheckoutRecovery(row, error.recovery);
      else if (hasCollectedPayment(row)) await recover();
    }
  }).catch((error) => {
    if (isPosPermissionCurrent(permission)) recordPosSyncError("outbox", {
      siteId: queued.siteId, operation: "outbox", error: error instanceof Error ? error.message : "Sync failed",
    });
  }).finally(() => {
    clearTimeout(timer);
    inFlight.delete(key);
    changed(queued.siteId);
  });
  const wait = Promise.race([request, timedOut]);
  inFlight.set(key, { siteId: queued.siteId, wait });
  changed(queued.siteId);
  return wait;
}