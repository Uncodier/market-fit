"use client";

import { useEffect, useState } from "react";
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
};
const CHECKING: AccessState = { status: "checking", lease: null };
const ROLES = new Set(["owner", "admin", "collaborator", "marketing"]);

/** A fresh online grant is mandatory; a persisted ownership marker is not a grant. */
export function usePosLocationAccess(siteId?: string, userId?: string, authLoading = false) {
  const [state, setState] = useState<AccessState>(CHECKING);

  useEffect(() => {
    // Loading context is not a confirmed sign-out/site switch. Do not erase drafts.
    if (authLoading || (!siteId && userId)) {
      suspendPosPermission();
      return;
    }
    let disposed = false;
    let sequence = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth = () => {};
    const unsubscribe = subscribePosPermission((reason) => {
      if (!disposed) setState(reason === "expired" ? { status: "unavailable", lease: null } : CHECKING);
    });
    const preparation = preparePosPermission(userId ?? null, siteId ?? null);
    // Storage failures lock the workspace even if the browser is offline.
    void preparation.catch(() => { if (!disposed) setState({ status: "unavailable", lease: null }); });
    const current = (request: number) => !disposed && sequence === request;

    const deny = async (request: number, status: "restricted" | "unavailable", purge = false) => {
      if (!current(request)) return;
      suspendPosPermission();
      setState({ status, lease: null });
      if (purge) {
        try { await revokePosPermission(); } catch { /* Remain locked if storage is unavailable. */ }
        if (current(request)) setState({ status, lease: null });
      }
    };

    const refresh = async () => {
      const request = ++sequence;
      clearTimeout(timeout);
      if (!siteId || !userId || !navigator.onLine) {
        await deny(request, "unavailable");
        return;
      }
      timeout = setTimeout(() => {
        if (!current(request)) return;
        void deny(request, "unavailable");
        sequence += 1;
      }, POS_PERMISSION_TIMEOUT_MS);
      try {
        await preparation;
        if (!current(request)) return;
        const client = createClient();
        const auth = await client.auth.getUser();
        if (!current(request)) return;
        if (auth.error || !auth.data.user) {
          await deny(request, "unavailable", !auth.error);
          return;
        }
        if (auth.data.user.id !== userId) {
          await deny(request, "unavailable", true);
          return;
        }
        // Independent server checks, never the cached UI permission context.
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
          await deny(request, "unavailable", !membership.error && !ROLES.has(membership.data));
          return;
        }
        const grant = await acceptPosPermission({ userId, siteId, role: membership.data }, () => current(request));
        if (current(request) && grant) setState({ status: "allowed", lease: grant });
      } catch {
        await deny(request, "unavailable");
      } finally {
        if (current(request)) clearTimeout(timeout);
      }
    };

    try {
      const { data } = createClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        sequence += 1;
        // A same-actor refresh verifies in the background without retiring the cart.
        // The independent lease deadline still bounds an unanswered check.
        if (event !== "TOKEN_REFRESHED" || session?.user.id !== userId) suspendPosPermission();
        if (session?.user.id !== userId) void revokePosPermission().catch(() => undefined);
        // Auth callbacks must not await another auth request (Supabase lock).
        clearTimeout(authTimer);
        authTimer = setTimeout(() => { void refresh(); }, 0);
      });
      unsubscribeAuth = () => data.subscription.unsubscribe();
    } catch { /* Verification below fails closed for missing clients. */ }

    const onOffline = () => { sequence += 1; void deny(sequence, "unavailable"); };
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
  }, [siteId, userId, authLoading]);

  const grant = state.lease;
  if (authLoading) return CHECKING;
  if (state.status === "allowed" && (!grant || grant.siteId !== siteId || grant.userId !== userId || !getPosPermissionLease(siteId))) {
    return CHECKING;
  }
  return state;
}