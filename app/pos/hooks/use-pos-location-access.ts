"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  acceptPosPermission, getPosPermissionLease, preparePosPermission,
  revokePosPermission, subscribePosPermission, suspendPosPermission,
  POS_PERMISSION_REFRESH_MS, POS_PERMISSION_TIMEOUT_MS,
  type PosPermissionLease,
} from "../local/location-permission-state";

type AccessState = {
  status: "checking" | "allowed" | "restricted" | "unavailable";
  lease: PosPermissionLease | null;
  reason?: "offline" | "session" | "permission" | "storage" | "timeout" | "context";
  retry?: () => void;
};
const CHECKING: AccessState = { status: "checking", lease: null };
const ROLES = new Set(["owner", "admin", "collaborator", "marketing"]);

/** A fresh online grant is mandatory; a persisted ownership marker is not a grant. */
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
    let inFlight = false;
    let timedOut = false;
    let activeRequest = 0;
    let recheck = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth = () => {};
    const unsubscribe = subscribePosPermission((reason) => {
      if (!disposed) setState((previous) => {
        if (reason === "expired") return { status: "unavailable", lease: null, reason: "timeout" };
        // Invalidating scope cannot restart loading after the only deadline fired.
        // The pending SDK operation must settle before another check can start.
        if (inFlight && timedOut && previous.status === "unavailable") return previous;
        return CHECKING;
      });
    });
    const preparation = preparePosPermission(userId ?? null, siteId ?? null);
    // Storage failures lock the workspace even if the browser is offline.
    void preparation.catch(() => { if (!disposed) setState({ status: "unavailable", lease: null, reason: "storage" }); });
    const current = (request: number) => !disposed && sequence === request;

    const deny = async (request: number, status: "restricted" | "unavailable", purge = false, reason?: AccessState["reason"]) => {
      if (!current(request)) return;
      suspendPosPermission();
      setState({ status, lease: null, reason });
      if (purge) {
        try { await revokePosPermission(); } catch { /* Remain locked if storage is unavailable. */ }
        if (current(request)) setState({ status, lease: null, reason });
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
      activeRequest = request;
      clearTimeout(timeout);
      if (!siteId || !userId || !navigator.onLine) {
        await deny(request, "unavailable", false, !navigator.onLine ? "offline" : "session");
        return;
      }
      inFlight = true;
      timedOut = false;
      timeout = setTimeout(() => {
        if (disposed || !inFlight) return;
        timedOut = true;
        // Scope invalidation also has to leave pending UI within this deadline.
        void deny(sequence, "unavailable", false, navigator.onLine ? "timeout" : "offline");
        sequence += 1;
      }, POS_PERMISSION_TIMEOUT_MS);
      let failureReason: AccessState["reason"] = "storage";
      try {
        await preparation;
        if (!current(request)) return;
        failureReason = "session";
        const client = createClient();
        const auth = await client.auth.getUser();
        if (!current(request)) return;
        if (auth.error || !auth.data.user) {
          await deny(request, "unavailable", !auth.error, "session");
          return;
        }
        if (auth.data.user.id !== userId) {
          await deny(request, "unavailable", true, "session");
          return;
        }
        // Independent server checks, never the cached UI permission context.
        failureReason = "permission";
        const [restriction, globalRestriction, membership] = await Promise.all([
          client.rpc("current_user_has_site_location_restrictions", { p_site_id: siteId }),
          client.rpc("current_user_has_location_restrictions"),
          client.rpc("current_user_site_role", { p_site_id: siteId }),
        ]);
        if (!current(request)) return;
        if ((!restriction.error && restriction.data === true) || (!globalRestriction.error && globalRestriction.data === true)) {
          await deny(request, "restricted", true);
          return;
        }
        if (membership.error || !ROLES.has(membership.data) || restriction.error || restriction.data !== false || globalRestriction.error || globalRestriction.data !== false) {
          await deny(request, "unavailable", !membership.error && !ROLES.has(membership.data), "permission");
          return;
        }
        failureReason = "storage";
        const grant = await acceptPosPermission({ userId, siteId, role: membership.data }, () => current(request));
        if (current(request) && grant) setState({ status: "allowed", lease: grant });
      } catch {
        await deny(request, "unavailable", false, failureReason);
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
        const sameActor = event !== "SIGNED_OUT" && session?.user.id === userId;
        // INITIAL_SESSION and SIGNED_IN can reconfirm the same actor on focus.
        // They are not revocations and must not interrupt getUser/token refresh.
        if (sameActor && inFlight) return;
        if (!sameActor) {
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

    const onOffline = () => { sequence += 1; void deny(sequence, "unavailable", false, "offline"); };
    const onRefresh = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") onRefresh(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "pos-location-scope-v1") return;
      sequence += 1;
      suspendPosPermission();
      onRefresh();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(onRefresh, POS_PERMISSION_REFRESH_MS);
    void refresh();
    return () => {
      disposed = true;
      sequence += 1;
      clearTimeout(timeout);
      clearTimeout(authTimer);
      clearInterval(interval);
      unsubscribe();
      unsubscribeAuth();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("focus", onRefresh);
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