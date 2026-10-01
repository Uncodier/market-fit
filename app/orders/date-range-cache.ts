import type { Locale } from "date-fns";
import { cacheDateRange, readDateRange, type CachedDateRange } from "@/lib/dates/date-range-cache";

export type OrdersDateRange = CachedDateRange;

export function ordersDateRangeStorageKey(siteId: string): string {
  return `orders-date-range:${siteId}`;
}

export function readOrdersDateRange(
  siteId: string,
  locale?: Locale,
): OrdersDateRange | null | undefined {
  return readDateRange(ordersDateRangeStorageKey(siteId), locale);
}

export function cacheOrdersDateRange(
  siteId: string,
  range: OrdersDateRange | null,
) {
  cacheDateRange(ordersDateRangeStorageKey(siteId), range);
}
