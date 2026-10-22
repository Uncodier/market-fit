import "server-only";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { isPosOpenOrder } from "@/app/pos/open-orders";
import { posOrderMatchesVersion } from "@/app/pos/order-version";

/** Reject stale queued POS edits before checkout side effects. Not a database lock. */
export async function assertPosOrderCurrent(siteId: string, orderId: string, expected: string) {
  if (typeof expected !== "string" || !expected || expected.length > 500_000) {
    throw new Error("Invalid POS order version. Reload the order before payment.");
  }
  const result = await getPosOrder(siteId, orderId);
  if (result.error || !result.data || !isPosOpenOrder(result.data) ||
    result.data.id !== orderId || result.data.site_id !== siteId ||
    !posOrderMatchesVersion(result.data, expected)) {
    throw new Error("This order or its balance has changed. Reload it before payment.");
  }
}