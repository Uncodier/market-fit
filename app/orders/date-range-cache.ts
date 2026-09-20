export type OrdersDateRange = {
  startDate: Date;
  endDate: Date;
};

type StoredOrdersDateRange = {
  startDate: string;
  endDate: string;
};

const STORAGE_PREFIX = "orders-date-range:";

export function ordersDateRangeStorageKey(siteId: string): string {
  return `${STORAGE_PREFIX}${siteId}`;
}

export function readOrdersDateRange(
  siteId: string,
): OrdersDateRange | null | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(ordersDateRangeStorageKey(siteId));
    if (raw === null) return undefined;

    const stored = JSON.parse(raw) as StoredOrdersDateRange | null;
    if (stored === null) return null;

    const startDate = new Date(stored.startDate);
    const endDate = new Date(stored.endDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return undefined;
    }

    return { startDate, endDate };
  } catch {
    return undefined;
  }
}

export function cacheOrdersDateRange(
  siteId: string,
  range: OrdersDateRange | null,
) {
  if (typeof window === "undefined") return;
  const stored: StoredOrdersDateRange | null = range
    ? {
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      }
    : null;
  try {
    window.localStorage.setItem(
      ordersDateRangeStorageKey(siteId),
      JSON.stringify(stored),
    );
  } catch (error) {
    console.warn("Failed to cache the orders date range:", error);
  }
}
