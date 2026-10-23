import { fetchPosOrder } from "./operation-client";
import { isPosOpenOrder } from "@/app/pos/open-orders";
import { posOrderMatchesVersion } from "@/app/pos/order-version";

export class PosOrderChangedError extends Error {
  constructor() {
    super("This order or its balance has changed. Review the refreshed order before taking payment.");
  }
}

/** Opening the payment dialog is immediate; confirming an old snapshot is not. */
export async function checkOrderBeforePayment(
  siteId: string, orderId: string, expectedVersion?: string,
): Promise<void> {
  if (orderId === "new") return;
  if (orderId.startsWith("local_")) {
    throw new Error("Wait for this order to sync before taking another payment.");
  }
  if (!expectedVersion) {
    throw new Error("Please select the order again to refresh it before payment.");
  }
  const result = await fetchPosOrder(siteId, orderId);
  if (result.error || !result.data) throw new Error("Unable to verify the order. No payment was queued. Please try again.");
  if (!isPosOpenOrder(result.data) || !posOrderMatchesVersion(result.data, expectedVersion)) {
    throw new PosOrderChangedError();
  }
}