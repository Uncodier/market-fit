"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { posStorageDiagnostic } from "../local/storage-diagnostic";
import { notifyPosAccessUpdated, POS_ACCESS_RECHECK_EVENT } from "../local/access-recheck";
import {
  acceptPosPermission, getPosPermissionLease, preparePosPermission,
  revokePosPermission, restorePosPermission, subscribePosPermission, suspendPosPermission,
  POS_PERMISSION_REFRESH_MS, POS_PERMISSION_TIMEOUT_MS,
  type PosPermissionLease,
} from "../local/location-permission-state";

type AccessState = {
  status: "checking" | "allowed" | "restricted" | "unavailable";
  lease: PosPermissionLease | null;
  reason?: "offline" | "session" | "permission" | "storage" | "timeout" | "context";
  retry?: () => void;
  diagnostic?: string;
};
const CHECKING: AccessState = { status: "checking", lease: null };
const ROLES = new Set(["owner", "admin", "collaborator", "marketing"]);

/** Remote access is freshly verified; downloaded data can use the same verified local scope. */
export function usePosLocationAccess(siteId?: string, userId?: string, authLoading = false): AccessState {
  const [state, setState] = useState<AccessState>(CHECKING);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setState(CHECKING); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    // Loading context is not a confirmed sign-out/site switch. Do not erase drafts.
    if (authLoading || (!siteId && userId)) {
      suspendPosPermission();
      const contextTimeout = setTimeout(() => {
        setState({ status: "unavailable", lease: null, reason: "context" });
      }, POS_PERMISSION_TIMEOUT_MS);
      return () => clearTimeout(contextTimeout);
    }
    let disposed = false;
    let sequence = 0;
    // Fallback changes request freshness, not the identity/scope of a denial.
    let scopeEpoch = 0;
    let permissionRevoked = false;
    let inFlight = false;
    let timedOut = false;
    let activeRequest = 0;
    let recheck = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let unsubscribeAuth = () => {};
    const unsubscribe = subscribePosPermission((reason) => {
      if (disposed) return;
      if (reason === "expired") {
        void restoreCachedAccess(sequence, "timeout");
        return;
      }
      if (!disposed) setState((previous) => {
        // Invalidating scope cannot restart loading after the only deadline fired.
        // The pending SDK operation must settle before another check can start.
        if (inFlight && timedOut && previous.status === "unavailable") return previous;
        return CHECKING;
      });
    });
    const preparation = preparePosPermission(userId ?? null, siteId ?? null);
    let prepared = false;
    void preparation.then(() => { prepared = true; }, () => undefined);
    // Storage failures lock the workspace even if the browser is offline.
    void preparation.catch((error) => { if (!disposed) setState({ status: "unavailable", lease: null, reason: "storage", diagnostic: posStorageDiagnostic(error) }); });
    const current = (request: number) => !disposed && sequence === request;

    const deny = async (request: number, status: "restricted" | "unavailable", purge = false, reason?: AccessState["reason"], diagnostic?: string) => {
      if (!current(request)) return;
      suspendPosPermission();
      setState({ status, lease: null, reason, diagnostic });
      if (purge) {
        permissionRevoked = true;
        try { await revokePosPermission(); } catch { /* Remain locked if storage is unavailable. */ }
        if (current(request)) setState({ status, lease: null, reason });
      }
    };

    const restoreCachedAccess = async (request: number, reason: AccessState["reason"]) => {
      try {
        await preparation;
        if (!current(request)) return;
        const grant = !permissionRevoked && userId && siteId
          ? await restorePosPermission(userId, siteId, () => current(request) && !permissionRevoked) : null;
        if (!current(request)) return;
        if (grant) {
          setState({ status: "allowed", lease: grant });
          notifyPosAccessUpdated();
        }
        else await deny(request, "unavailable", false, reason);
      } catch (error) {
        await deny(request, "unavailable", false, "storage", posStorageDiagnostic(error));
      }
    };

    const refresh = async () => {
      // Do not invalidate a current check or move its deadline on duplicate events.
      // Keep SDK work single-flight even after the UI deadline, until it settles.
      if (disposed) return;
      if (inFlight) {
        if (sequence !== activeRequest) recheck = true;
        return;
      }
      const request = ++sequence;
      const requestScope = scopeEpoch;
      const revokeForScope = async (status: "restricted" | "unavailable", reason?: AccessState["reason"]) => {
        if (disposed || requestScope !== scopeEpoch) return;
        // Cancel pending cache restoration too. Only denials may outlive fallback.
        await deny(++sequence, status, true, reason);
      };
      activeRequest = request;
      clearTimeout(timeout);
      if (!siteId || !userId) {
        await deny(request, "unavailable", false, "session");
        return;
      }
      if (!navigator.onLine) {
        await restoreCachedAccess(request, "offline");
        return;
      }
      inFlight = true;
      timedOut = false;
      controller = new AbortController();
      timeout = setTimeout(() => {
        if (disposed || !inFlight) return;
        timedOut = true;
        // Scope invalidation also has to leave pending UI within this deadline.
        sequence += 1;
        // Cancel DB transport as well as the UI wait, so a hung RPC cannot keep
        // every future sync/access check behind the same in-flight slot.
        controller?.abort();
        if (!prepared) void deny(sequence, "unavailable", false, "timeout");
        else void restoreCachedAccess(sequence, navigator.onLine ? "timeout" : "offline");
      }, POS_PERMISSION_TIMEOUT_MS);
      let failureReason: AccessState["reason"] = "storage";
      try {
        await preparation;
        if (!current(request)) return;
        failureReason = "session";
        const client = createClient();
        const auth = await client.auth.getUser();
        if (isPosAuthorizationDenial(auth.error) || (!auth.error && auth.data.user?.id !== userId)) {
          await revokeForScope("unavailable", "session");
          return;
        }
        if (!current(request)) return;
        if (auth.error || !auth.data.user) {
          if (auth.error && isPosConnectionFailure(auth.error)) {
            await restoreCachedAccess(request, navigator.onLine ? "session" : "offline");
            return;
          }
          await deny(request, "unavailable", false, "session");
          return;
        }
        // Independent server checks, never the cached UI permission context.
        failureReason = "permission";
        const [restriction, globalRestriction, membership] = await Promise.all([
          client.rpc("current_user_has_site_location_restrictions", { p_site_id: siteId }).abortSignal(controller.signal),
          client.rpc("current_user_has_location_restrictions").abortSignal(controller.signal),
          client.rpc("current_user_site_role", { p_site_id: siteId }).abortSignal(controller.signal),
        ]);
        if ((!restriction.error && restriction.data === true) || (!globalRestriction.error && globalRestriction.data === true)) {
          await revokeForScope("restricted");
          return;
        }
        if ((!membership.error && !ROLES.has(membership.data)) ||
          [membership.error, restriction.error, globalRestriction.error].some(isPosAuthorizationDenial)) {
          await revokeForScope("unavailable", "permission");
          return;
        }
        if (!current(request)) return;
        if (membership.error || !ROLES.has(membership.data) || restriction.error || restriction.data !== false || globalRestriction.error || globalRestriction.data !== false) {
          const errors = [membership.error, restriction.error, globalRestriction.error].filter(Boolean);
          if (errors.length && errors.every(isPosConnectionFailure) &&
            (membership.error || ROLES.has(membership.data))) {
            await restoreCachedAccess(request, navigator.onLine ? "permission" : "offline");
            return;
          }
          await deny(request, "unavailable", false, "permission");
          return;
        }
        failureReason = "storage";
        const grant = await acceptPosPermission({ userId, siteId, role: membership.data }, () => current(request));
        if (current(request) && grant) {
          permissionRevoked = false;
          setState({ status: "allowed", lease: grant });
          notifyPosAccessUpdated();
        }
      } catch (error) {
        if (failureReason !== "storage" && isPosAuthorizationDenial(error)) await revokeForScope("unavailable", failureReason);
        else if (failureReason !== "storage" && isPosConnectionFailure(error)) await restoreCachedAccess(request, navigator.onLine ? failureReason : "offline");
        else await deny(request, "unavailable", false, failureReason, failureReason === "storage" ? posStorageDiagnostic(error) : undefined);
      } finally {
        inFlight = false;
        clearTimeout(timeout);
        if (!disposed && recheck) {
          recheck = false;
          clearTimeout(authTimer);
          authTimer = setTimeout(() => { void refresh(); }, 0);
        }
      }
    };

    try {
      const { data } = createClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        if (event === "INITIAL_SESSION" && !session) {
          // An empty initial SDK snapshot is not a confirmed sign-out. Fence old
          // requests and offline restoration, then verify without destroying drafts.
          scopeEpoch += 1;
          permissionRevoked = true;
          sequence += 1;
          suspendPosPermission();
          clearTimeout(authTimer);
          authTimer = setTimeout(() => { void refresh(); }, 0);
          return;
        }
        const sameActor = event !== "SIGNED_OUT" && session?.user.id === userId;
        // INITIAL_SESSION and SIGNED_IN can reconfirm the same actor on focus.
        // They are not revocations and must not interrupt getUser/token refresh.
        if (sameActor && inFlight) return;
        if (!sameActor) {
          scopeEpoch += 1;
          permissionRevoked = true;
          sequence += 1;
          suspendPosPermission();
          void revokePosPermission().catch(() => undefined);
        }
        // Auth callbacks must not await another auth request (Supabase lock).
        clearTimeout(authTimer);
        authTimer = setTimeout(() => { void refresh(); }, 0);
      });
      unsubscribeAuth = () => data.subscription.unsubscribe();
    } catch { /* Verification below fails closed for missing clients. */ }

    const onOffline = () => {
      sequence += 1;
      clearTimeout(timeout);
      // Offline fallback retires the deadline too; cancel DB transport now so
      // reconnection does not wait forever for the abandoned request slot.
      controller?.abort();
      void restoreCachedAccess(sequence, "offline");
    };
    const onRefresh = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") onRefresh(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "pos-location-scope-v1") return;
      scopeEpoch += 1;
      sequence += 1;
      suspendPosPermission();
      onRefresh();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener(POS_ACCESS_RECHECK_EVENT, onRefresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(onRefresh, POS_PERMISSION_REFRESH_MS);
    void refresh();
    return () => {
      disposed = true;
      sequence += 1;
      clearTimeout(timeout);
      controller?.abort();
      clearTimeout(authTimer);
      clearInterval(interval);
      unsubscribe();
      unsubscribeAuth();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(POS_ACCESS_RECHECK_EVENT, onRefresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      suspendPosPermission();
    };
  }, [siteId, userId, authLoading, attempt]);

  const grant = state.lease;
  if (authLoading || (!siteId && userId)) {
    return { ...(state.reason === "context" ? state : CHECKING), retry };
  }
  if (state.status === "allowed" && (!grant || grant.siteId !== siteId || grant.userId !== userId || !getPosPermissionLease(siteId))) {
    return { ...CHECKING, retry };
  }
  return { ...state, retry };
}

/** Only transport loss can use cached access; explicit auth/permission errors stay denied. */
function isPosConnectionFailure(error: unknown): boolean {
  if (isPosAuthorizationDenial(error)) return false;
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; message?: string; status?: number };
  if (value.status && value.status >= 400 && value.status < 500) return false;
  if (!navigator.onLine) return true;
  return value.name === "AuthRetryableFetchError" ||
    /failed to fetch|fetch failed|networkerror|network request failed|load failed|network connection/i.test(value.message || "");
}

function isPosAuthorizationDenial(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number | string; code?: string };
  return Number(value.status) === 401 || Number(value.status) === 403 || value.code === "42501";
}