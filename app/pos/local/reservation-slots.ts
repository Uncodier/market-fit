import { getAvailableSlots } from "@/app/reservations/availability";
import { getPosDb } from "./db";
import type { LocalReservationSlots } from "./types";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type SlotsResult = {
  slots: LocalReservationSlots["slots"];
  fromCache: boolean;
};

const inflight = new Map<string, Promise<SlotsResult>>();

export function reservationSlotsKey(
  catalogItemId: string,
  startDate: string,
  endDate: string,
) {
  return `${catalogItemId}:${startDate}:${endDate}`;
}

export function reservationSlotsRequestKey(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
  qty?: number;
  ignoreReservationId?: string;
}) {
  return `${reservationSlotsKey(
    params.catalogItemId,
    params.startDate,
    params.endDate,
  )}:${params.qty ?? 1}:${params.ignoreReservationId ?? ""}`;
}

export function clearReservationSlotsInflight() {
  inflight.clear();
}

export async function getCachedReservationSlots(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
}): Promise<LocalReservationSlots["slots"] | null> {
  const id = reservationSlotsKey(
    params.catalogItemId,
    params.startDate,
    params.endDate,
  );
  const row = await getPosDb().reservationSlots.get(id);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await getPosDb().reservationSlots.delete(id);
    return null;
  }
  return row.slots;
}

export async function cacheReservationSlots(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
  slots: LocalReservationSlots["slots"];
  ttlMs?: number;
}) {
  const id = reservationSlotsKey(
    params.catalogItemId,
    params.startDate,
    params.endDate,
  );
  const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
  const row: LocalReservationSlots = {
    id,
    catalogItemId: params.catalogItemId,
    startDate: params.startDate,
    endDate: params.endDate,
    slots: params.slots,
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  };
  await getPosDb().reservationSlots.put(row);
}

async function fetchReservationSlotsNetwork(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
  qty?: number;
  ignoreReservationId?: string;
}): Promise<SlotsResult> {
  const skipCache = Boolean(params.ignoreReservationId);
  const slots = await getAvailableSlots(
    params.catalogItemId,
    params.startDate,
    params.endDate,
    params.qty ?? 1,
    params.ignoreReservationId,
  );
  if (!skipCache) {
    await cacheReservationSlots({
      catalogItemId: params.catalogItemId,
      startDate: params.startDate,
      endDate: params.endDate,
      slots,
    });
  }
  return { slots, fromCache: false };
}

/** Fetch slots online and cache; fall back to cache when offline/error. */
export async function getReservationSlotsLocalFirst(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
  qty?: number;
  ignoreReservationId?: string;
}): Promise<SlotsResult> {
  const key = reservationSlotsRequestKey(params);
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<SlotsResult> => {
    const skipCache = Boolean(params.ignoreReservationId);
    const cached = skipCache ? null : await getCachedReservationSlots(params);
    if (cached) return { slots: cached, fromCache: true };

    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      return { slots: [], fromCache: true };
    }

    try {
      return await fetchReservationSlotsNetwork(params);
    } catch {
      return { slots: [], fromCache: true };
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}
