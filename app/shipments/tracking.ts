/**
 * Pure helpers for shipment tracking / location guards (no server deps).
 */

export function buildTrackingNumber(siteId: string, now = new Date(), randomPart?: string): string {
  const shortSite = siteId.substring(0, 4).toUpperCase();
  const dateStr = now.toISOString().replace(/[-T:.Z]/g, "").substring(0, 8);
  const random6 = (randomPart || Math.random().toString(36).substring(2, 8)).toUpperCase().padEnd(6, "0").substring(0, 6);
  return `MF-${shortSite}-${dateStr}-${random6}`;
}

export function canRecordShipmentLocation(params: {
  assignedTo: string | null | undefined;
  status: string;
  userId: string;
}): { ok: true } | { ok: false; error: string } {
  if (!params.assignedTo || params.assignedTo !== params.userId) {
    return { ok: false, error: "Only the assigned courier can record location" };
  }
  if (params.status !== "in_transit") {
    return { ok: false, error: "Location can only be recorded while shipment is in transit" };
  }
  return { ok: true };
}

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["in_transit", "delivered", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  cancelled: [],
  failed: [],
};
