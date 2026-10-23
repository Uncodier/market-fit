"use client";

import type { getPosCatalogRevision } from "./actions/sync-revision";

export const CATALOG_REVISION_WAIT_MS = 8_000;
type RevisionResult = Awaited<ReturnType<typeof getPosCatalogRevision>>;
const inFlight = new Map<string, Promise<RevisionResult>>();

/** Read-only HTTP avoids the browser's serialized Server Action queue. */
export function fetchPosCatalogRevision(siteId: string): Promise<RevisionResult> {
  const existing = inFlight.get(siteId);
  if (existing) return existing;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async (): Promise<RevisionResult> => {
    try {
      const response = await fetch(`/api/pos/catalog-revision?siteId=${encodeURIComponent(siteId)}`, {
        method: "GET", credentials: "same-origin", mode: "same-origin", cache: "no-store",
        redirect: "error", headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        return { error: "Unable to check the catalog revision" };
      }
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "data" in body && typeof body.data === "string" && body.data.length > 0) {
        return { data: body.data };
      }
      return { error: "Unable to check the catalog revision" };
    } catch { return { error: "Unable to check the catalog revision" }; }
  };
  const request = Promise.race([
    read(),
    new Promise<RevisionResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({ error: "Catalog revision check timed out" });
        controller.abort();
      }, CATALOG_REVISION_WAIT_MS);
    }),
  ]).finally(() => { clearTimeout(timer); inFlight.delete(siteId); });
  inFlight.set(siteId, request);
  return request;
}