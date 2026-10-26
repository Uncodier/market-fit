import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { requirePosSiteAccess } from "./actions/site-access";

type Access = Awaited<ReturnType<typeof requirePosSiteAccess>>;
type Scope = { active: boolean; access: Map<string, Promise<Access>> };
const scopes = new AsyncLocalStorage<Scope>();

/** Server-created scope only: no credentials or authorization flags are accepted. */
export async function withPosCheckoutAccessScope<T>(work: () => Promise<T>): Promise<T> {
  const scope: Scope = { active: true, access: new Map() };
  return scopes.run(scope, async () => {
    try { return await work(); }
    finally { scope.active = false; scope.access.clear(); }
  });
}

/** Direct Server Action calls always authorize; only this operation's lookup is reused. */
export function requirePosCheckoutAccess(siteId: string): Promise<Access> {
  const scope = scopes.getStore();
  if (!scope?.active) return requirePosSiteAccess(siteId);
  let access = scope.access.get(siteId);
  if (!access) {
    access = requirePosSiteAccess(siteId);
    scope.access.set(siteId, access);
  }
  return access;
}