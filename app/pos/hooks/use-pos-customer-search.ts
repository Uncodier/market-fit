"use client";

import { useEffect, useMemo, useState } from "react";
import { searchPosCustomers } from "../actions/search-customers";
import { posCustomerSearchText, type PosCustomer } from "../customer-search";
import { getPosPermissionLease, subscribePosPermission } from "../local/location-permission-state";
import { canStartPosRemoteRequest } from "../local/remote-permission";

export function usePosCustomerSearch(siteId: string | undefined, query: string,
  localLeads: PosCustomer[], enabled = true) {
  const term = query.trim();
  const key = JSON.stringify([siteId, term]);
  const [state, setState] = useState<{
    key: string; result: Awaited<ReturnType<typeof searchPosCustomers>>;
  }>();
  const [connectionVersion, setConnectionVersion] = useState(0);

  useEffect(() => {
    const update = () => { setState(undefined); setConnectionVersion((version) => version + 1); };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const unsubscribe = subscribePosPermission(update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      unsubscribe();
    };
  }, []);

  const permission = getPosPermissionLease(siteId);
  const online = Boolean(siteId && canStartPosRemoteRequest(permission));
  useEffect(() => {
    if (!enabled || !siteId || !term || term.length > 200 || !online) return;
    const lease = getPosPermissionLease(siteId);
    let current = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      if (!canStartPosRemoteRequest(lease)) return;
      timeout = setTimeout(() => {
        if (current && canStartPosRemoteRequest(lease)) {
          setState({ key, result: { leads: [], error: "Customer search timed out. Try again. Local customers remain available." } });
          current = false;
        }
      }, 10_000);
      void searchPosCustomers(siteId, term).then((result) => {
        clearTimeout(timeout);
        if (current && canStartPosRemoteRequest(lease)) setState({ key, result });
      }).catch(() => {
        clearTimeout(timeout);
        if (current && canStartPosRemoteRequest(lease)) setState({ key, result: {
          leads: [], error: "Customer search is unavailable. Local customers remain available.",
        } });
      });
    }, 300);
    return () => { current = false; clearTimeout(timer); clearTimeout(timeout); };
  }, [siteId, term, key, online, enabled, connectionVersion]);

  const result = enabled && online && state?.key === key ? state.result : undefined;
  const leads = useMemo(() => {
    const merged = new Map<string, PosCustomer>();
    for (const lead of localLeads) {
      if ((!lead.site_id || lead.site_id === siteId) &&
        (!term || posCustomerSearchText(lead).toLowerCase().includes(term.toLowerCase()))) merged.set(lead.id, lead);
    }
    for (const lead of result?.leads || []) {
      if (lead.site_id === siteId) merged.set(lead.id, lead);
    }
    return Array.from(merged.values());
  }, [localLeads, result, siteId, term]);

  const status = !enabled || !term ? null
    : term.length > 200 ? "Use at most 200 characters for customer search."
    : !online ? "Online customer search requires a connection and verified POS access. Local customers remain available."
    : !result ? "Searching customers…" : result.error || null;
  return { leads, status, searching: Boolean(enabled && term && online && term.length <= 200 && !result) };
}