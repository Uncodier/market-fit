"use client";

import { useEffect, useRef } from "react";
import { fetchActivePaymentRegister } from "../operation-client";
import { getPosPermissionLease, isPosPermissionCurrent } from "../local/location-permission-state";
import { readRegisterPreflightRevision } from "../register/preflight-revision";

type RegisterResult = Awaited<ReturnType<typeof fetchActivePaymentRegister>>;
const MAX_AGE_MS = 15_000;

/** A short-lived read hint, never authorization. Checkout revalidates the shift on the server. */
export function usePaymentRegisterPreflight(
  siteId: string | undefined, userId: string | undefined, locationId: string,
  cartSessionKey: string, enabled: boolean,
) {
  const permission = getPosPermissionLease(siteId);
  const key = JSON.stringify([siteId, userId, locationId, cartSessionKey,
    permission?.generation, permission?.remoteGeneration]);
  const pending = useRef<{ key: string; revision: string; startedAt: number; result: Promise<RegisterResult> } | null>(null);
  const canRead = () => !!siteId && !!userId && navigator.onLine && !permission?.offline &&
    isPosPermissionCurrent(permission) &&
    getPosPermissionLease(siteId)?.remoteGeneration === permission?.remoteGeneration;
  const read = (): Promise<RegisterResult> => fetchActivePaymentRegister({ siteId, ...(locationId ? { locationId } : {}) })
    .catch(() => ({ error: "Unable to load the cash register. Please try again." }));
  const start = () => {
    if (!siteId || !canRead()) return;
    const revision = readRegisterPreflightRevision(siteId);
    if (revision === null) return;
    if (pending.current?.key === key && pending.current.revision === revision &&
      performance.now() - pending.current.startedAt < MAX_AGE_MS) return;
    const prepared = { key, revision, startedAt: performance.now(), result: read() };
    pending.current = prepared;
    void prepared.result.then((result) => {
      if (result.error !== undefined && pending.current === prepared) pending.current = null;
    });
  };
  useEffect(() => {
    if (enabled) start();
    else pending.current = null;
    return () => { pending.current = null; };
    // Only a dialog/scope change starts a speculative read, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return {
    start,
    // Called inside the payment lock: a completed close must invalidate old hints
    // before they can supply a registerSessionId to the durable payment queue.
    async take(): Promise<RegisterResult> {
      const prepared = pending.current;
      if (prepared?.key === key) pending.current = null;
      const accessError = { error: "POS access changed. Refresh before collecting payment." };
      if (!siteId || !canRead()) return accessError;
      if (prepared?.key === key && prepared.revision === readRegisterPreflightRevision(siteId) &&
        performance.now() - prepared.startedAt < MAX_AGE_MS) {
        const result = await prepared.result;
        if (!canRead()) return accessError;
        if (result.error === undefined && prepared.revision === readRegisterPreflightRevision(siteId)) return result;
      }
      // A failed speculative read must not fail the cashier's first submission.
      // This is one fresh read, never a replay of a payment mutation.
      return canRead() ? read() : accessError;
    },
  };
}