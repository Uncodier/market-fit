import { getAvailableSlots } from "@/app/reservations/availability";
import { getPosDb } from "./db";
import type { LocalReservationSlots } from "./types";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function reservationSlotsKey(
  catalogItemId: string,
  startDate: string,
  endDate: string,
) {
  return `${catalogItemId}:${startDate}:${endDate}`;
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

/** Fetch slots online and cache; fall back to cache when offline/error. */
export async function getReservationSlotsLocalFirst(params: {
  catalogItemId: string;
  startDate: string;
  endDate: string;
  qty?: number;
}): Promise<{ slots: LocalReservationSlots["slots"]; fromCache: boolean }> {
  const cached = await getCachedReservationSlots(params);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (!online) {
    return { slots: cached || [], fromCache: true };
  }

  try {
    const slots = await getAvailableSlots(
      params.catalogItemId,
      params.startDate,
      params.endDate,
      params.qty ?? 1,
    );
    await cacheReservationSlots({
      catalogItemId: params.catalogItemId,
      startDate: params.startDate,
      endDate: params.endDate,
      slots,
    });
    return { slots, fromCache: false };
  } catch {
    return { slots: cached || [], fromCache: true };
  }
}
