import { getPosDb } from "./db";
import { updateOutboxRow } from "./outbox";
import { applyOutboxItem } from "./sync-outbox-item";
import { syncCheckoutDependencies } from "./sync-checkout-dependencies";
import { applyPosCheckoutRecovery, reconcilePosCheckout } from "./checkout-recovery";
import { PosCheckoutRecoveryError } from "../checkout-recovery-types";
import { clearPosSyncError, recordPosSyncError } from "./sync-errors";
import { isPosPermissionCurrent, type PosPermissionLease } from "./location-permission-state";
import type { PosOutboxRow } from "./types";
import { canStartPosRemoteRequest } from "./remote-permission";
import { checkoutRetryDelay, supportsAutomaticCheckoutRetry } from "./automatic-checkout-retry";

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
  const remote = canStartPosRemoteRequest(permission);
  if (!remote && !submitted) return;
  const db = getPosDb();
  await db.transaction("rw", db.outbox, async () => {
    const current = await db.outbox.get(row.id);
    // A timeout can race a successful response or manual evidence lookup.
    if (!current || current.status === "synced" || !isPosPermissionCurrent(permission)) return;
    if (current.recoveryState) {
      if (submitted && current.status === "syncing" && current.recoveryState === "review_required") {
        await updateOutboxRow(row.id, { status: "failed" });
      }
      return;
    }
    await updateOutboxRow(row.id, {
      ...(submitted ? { status: "failed" as const } : {}),
      lastError: remote ? message : null,
      ...(!remote && submitted && hasCollectedPayment(row) ? { recoveryState: "review_required" as const,
        recoveryMessage: "Payment status is unconfirmed. Check its status after reconnecting; do not collect it again." } : {}),
    });
    if (canStartPosRemoteRequest(permission)) recordPosSyncError(`outbox:${row.id}`, {
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
  if (!canStartPosRemoteRequest(permission)) return Promise.resolve();
  if (ancestors.has(queued.id)) return Promise.reject(new Error("Cyclic local checkout dependency"));
  const key = JSON.stringify([queued.siteId, queued.id]);
  const active = inFlight.get(key);
  if (active) return active.wait;

  let row = queued;
  let submitted = false;
  let claimed: Pick<PosOutboxRow, "status" | "attempts" | "checkoutRetryAfter"> | null = null;
  const restoreUnsentClaim = async () => {
    if (!claimed || submitted || !isPosPermissionCurrent(permission)) return;
    const db = getPosDb();
    await db.transaction("rw", db.outbox, async () => {
      const current = await db.outbox.get(row.id);
      if (current?.status === "syncing" && !current.recoveryState && isPosPermissionCurrent(permission)) {
        await updateOutboxRow(row.id, claimed!);
      }
    });
  };
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
      // A blocked local store must not extend the caller deadline or release
      // ownership of the real request. Persistence remains best effort here.
      releaseWait();
      void recordFailure(row, permission, "Sync timed out", submitted)
        .catch(() => { /* An unavailable local store cannot prove a failed checkout. */ })
        .finally(() => { changed(row.siteId); });
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
    const automatic = supportsAutomaticCheckoutRetry(row);
    // Initial submission and unresolved dependencies must not accrue recovery
    // backoff. Only previously dispatched work reserves an evidence-check slot.
    if (automatic && (row.status !== "pending" || row.recoveryState)) {
      const db = getPosDb();
      const reserved = await db.transaction("rw", db.outbox, async () => {
        const current = await db.outbox.get(row.id);
        if (!current || current.status === "synced" || current.recoveryState === "rejected" ||
          !canStartPosRemoteRequest(permission) || (current.checkoutRetryAfter ?? 0) > Date.now()) return false;
        const checks = (current.checkoutRecoveryChecks ?? 0) + 1;
        await updateOutboxRow(row.id, { checkoutRecoveryChecks: checks,
          checkoutRetryAfter: Date.now() + checkoutRetryDelay(Math.max(current.attempts, checks)),
        });
        return true;
      });
      if (!reserved) return;
    }

    const recover = async (): Promise<boolean> => {
      if (!canStartPosRemoteRequest(permission)) return false;
      armDeadline(RECOVERY_WAIT_MS);
      try {
        const result = await reconcilePosCheckout(row.siteId, row.id);
        if (isPosPermissionCurrent(permission) && result.state === "completed") {
          clearPosSyncError(row.siteId, `outbox:${row.id}`);
        }
        // Absence alone is not authorization. The same identity is submitted to
        // server admission, whose lock also fences delayed/concurrent requests.
        return automatic && result.state === "not_found" && !isExpired() &&
          canStartPosRemoteRequest(permission);
      } catch { /* A failed evidence read never authorizes another collection. */ }
      return false;
    };
    let resendVerified = false;
    // Unpaid retries use admission to retrieve the original outcome without
    // requiring payment-reader privileges. Existing claims never execute again.
    const unpaidAdmission = automatic && !hasCollectedPayment(row);
    const needsEvidence = hasCollectedPayment(row);
    if (needsEvidence && (row.status !== "pending" || row.recoveryState)) {
      submitted = true;
      resendVerified = await recover();
      if (!resendVerified) return;
      armDeadline(SYNC_WAIT_MS);
    }
    if (row.recoveryState && !resendVerified && !unpaidAdmission) return;

    try {
      const chain = new Set(ancestors).add(row.id);
      await syncCheckoutDependencies(row, permission, (dependency) => {
        if (isExpired()) throw new Error("Sync timed out");
        return syncPosOutboxRow(dependency, permission, changed, chain);
      });
      if (isExpired() || !canStartPosRemoteRequest(permission)) return;
      // Dependencies may have taken time; never replay a newly confirmed row.
      const latest = await getPosDb().outbox.get(row.id);
      if (!latest || latest.status === "synced" || isExpired() || !isPosPermissionCurrent(permission)) return;
      if (latest.recoveryState === "rejected" || latest.recoveryState === "payment_recorded") return;
      if (!resendVerified && hasCollectedPayment(latest) && (latest.status !== "pending" || latest.recoveryState)) {
        submitted = true;
        await recover();
        return;
      }
      const db = getPosDb();
      const claimReady = await db.transaction("rw", db.outbox, async () => {
        const current = await db.outbox.get(row.id);
        if (!current || current.status === "synced" || current.recoveryState === "rejected" ||
          current.recoveryState === "payment_recorded" || !canStartPosRemoteRequest(permission) || isExpired()) return false;
        claimed = { status: current.status, attempts: current.attempts, checkoutRetryAfter: current.checkoutRetryAfter };
        await updateOutboxRow(row.id, { status: "syncing", attempts: current.attempts + 1,
          ...(automatic ? { checkoutRetryAfter: Date.now() + checkoutRetryDelay(
            Math.max(current.attempts + 1, current.checkoutRecoveryChecks ?? 0)),
          } : {}),
        });
        return true;
      });
      if (!claimReady) return;
      if (!isPosPermissionCurrent(permission)) return;
      if (isExpired() || !canStartPosRemoteRequest(permission)) {
        // A stalled claim or lost connection before dispatch is still unsent work.
        await restoreUnsentClaim();
        return;
      }
      await applyOutboxItem(row, permission, () => {
        if (isExpired()) throw new Error("Sync timed out");
        submitted = true;
      });
      if (isPosPermissionCurrent(permission)) clearPosSyncError(row.siteId, `outbox:${row.id}`);
    } catch (error) {
      if (!isPosPermissionCurrent(permission)) return;
      await restoreUnsentClaim();
      // Returned receipt evidence is useful local data even after remote admission closes.
      if (error instanceof PosCheckoutRecoveryError) {
        await applyPosCheckoutRecovery(row, error.recovery);
        return;
      }
      await recordFailure(row, permission, error instanceof Error ? error.message : "Sync failed", submitted);
      if (!submitted) return;
      if (hasCollectedPayment(row)) await recover();
    }
  }).catch((error) => {
    if (canStartPosRemoteRequest(permission)) recordPosSyncError("outbox", {
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