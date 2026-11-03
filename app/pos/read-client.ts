"use client";

import {
  parsePosCatalogRead, parsePosOrdersRead, posCatalogReadInput, posOrdersReadInput,
  type PosCatalogReadResult, type PosOpenOrdersResult,
} from "./read-contract";

export const POS_CATALOG_READ_WAIT_MS = 30_000;
export const POS_OPEN_ORDERS_READ_WAIT_MS = 12_000;

async function read<T>(path: string, waitMs: number, parse: (body: unknown) => T | null): Promise<T | null> {
  const controller = new AbortController();
  const deadline = Date.now() + waitMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = async () => {
    try {
      const response = await fetch(path, {
        method: "GET", credentials: "same-origin", mode: "same-origin", cache: "no-store",
        redirect: "error", headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return null;
      const body: unknown = await response.json();
      if (controller.signal.aborted || Date.now() >= deadline) return null;
      const result = parse(body);
      return controller.signal.aborted || Date.now() >= deadline ? null : result;
    } catch { return null; }
  };
  try {
    return await Promise.race([
      request(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => { resolve(null); controller.abort(); }, waitMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Independent HTTP reads; never share private responses across actor generations. */
export async function fetchPosCatalogSnapshot(siteId: string, revision?: string | null, bypassCache = false): Promise<PosCatalogReadResult> {
  const input = posCatalogReadInput.safeParse({
    siteId, revision: revision ?? undefined,
    // A null revision already means uncached in the existing snapshot action.
    bypassCache: bypassCache || revision === null ? "true" : "false",
  });
  if (!input.success) return { error: "Invalid POS catalog request" };
  const query = new URLSearchParams({ siteId, bypassCache: input.data.bypassCache! });
  if (input.data.revision !== undefined) query.set("revision", input.data.revision);
  const data = await read(`/api/pos/catalog-snapshot?${query}`, POS_CATALOG_READ_WAIT_MS, (body) => parsePosCatalogRead(body, siteId));
  return data ? { data } : { error: "Unable to load the POS catalog. The read failed or timed out." };
}

export async function fetchPosOpenOrders(siteId: string): Promise<PosOpenOrdersResult> {
  if (!posOrdersReadInput.safeParse({ siteId }).success) return { data: [], error: "Invalid POS orders request" };
  const data = await read(`/api/pos/open-orders?siteId=${encodeURIComponent(siteId)}`, POS_OPEN_ORDERS_READ_WAIT_MS, (body) => parsePosOrdersRead(body, siteId));
  return data ? { data } : { data: [], error: "Unable to load open POS orders. The read failed or timed out." };
}