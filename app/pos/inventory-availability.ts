import type { CatalogItem } from "@/app/types";

export type StockShortagePolicy = "allow" | "warn" | "block";

export type PosInventoryLevel = {
  catalog_item_id: string;
  location_id: string;
  quantity: number;
};

export type PosInventorySnapshot = {
  levels: PosInventoryLevel[];
  policy: StockShortagePolicy;
};

export type PosItemAvailability = {
  sellable: boolean;
  status: "available" | "sold_out" | "backorder" | "unknown";
  availableQty?: number;
  backorderQty: number;
  reason?: string;
};

/** PostgreSQL numeric values may arrive as strings. Never propagate NaN/Infinity. */
export function normalizePosInventoryQuantity(value: unknown): number {
  const number = typeof value === "number" || typeof value === "string"
    ? Number(value)
    : 0;
  return Number.isFinite(number)
    ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, number))
    : 0;
}

export function getPosItemAvailability(
  item: CatalogItem,
  inventory: PosInventorySnapshot | null | undefined,
  locationId?: string | null,
  requestedQuantity = 1,
): PosItemAvailability {
  if (item.status === "archived") {
    return { sellable: false, status: "sold_out", backorderQty: 0, reason: "This item is archived." };
  }
  if (item.availability_mode === "manual" && item.availability_status !== "available") {
    return {
      sellable: false,
      status: "sold_out",
      backorderQty: 0,
      reason: "This item is unavailable.",
    };
  }

  // Explicit availability modes take precedence over track_inventory.
  if (item.availability_mode !== "inventory") {
    return { sellable: true, status: "available", backorderQty: 0 };
  }

  if (!inventory) {
    return {
      sellable: false,
      status: "unknown",
      backorderQty: 0,
      reason: "Inventory availability could not be verified. Refresh and try again.",
    };
  }

  const quantity = normalizePosInventoryQuantity(requestedQuantity);
  if (quantity <= 0) {
    return { sellable: false, status: "unknown", backorderQty: 0, reason: "Enter a valid positive quantity." };
  }
  const requested = quantity;
  const total = inventory.levels.reduce((sum, level) => {
    if (level.catalog_item_id !== item.id || (locationId && level.location_id !== locationId)) {
      return sum;
    }
    return normalizePosInventoryQuantity(sum + normalizePosInventoryQuantity(level.quantity));
  }, 0);
  const availableQty = Math.max(0, total);
  if (requested <= availableQty) {
    return { sellable: true, status: "available", availableQty, backorderQty: 0 };
  }

  if (inventory.policy === "block") {
    return {
      sellable: false,
      status: "sold_out",
      availableQty,
      backorderQty: 0,
      reason: availableQty > 0 ? `Only ${availableQty} available.` : "This item is sold out.",
    };
  }

  return {
    sellable: true,
    status: "backorder",
    availableQty,
    backorderQty: requested - availableQty,
    reason: "The quantity above available stock will be backordered.",
  };
}