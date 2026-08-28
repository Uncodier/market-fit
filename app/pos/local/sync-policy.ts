export const CATALOG_INTERVAL_MS = 5 * 60_000;
export const ORDERS_INTERVAL_MS = 30_000;
export const CATALOG_VISIBILITY_MIN_MS = 2 * 60_000;

export function shouldRunCatalogPull({
  now,
  lastCatalogAt,
  visible,
  force,
  isVisibilityTrigger,
}: {
  now: number;
  lastCatalogAt: number | null;
  visible: boolean;
  force?: boolean;
  isVisibilityTrigger?: boolean;
}): boolean {
  if (force) return true;
  if (!visible) return false;
  if (!lastCatalogAt) return true;
  
  const elapsed = now - lastCatalogAt;
  if (elapsed >= CATALOG_INTERVAL_MS) return true;
  if (isVisibilityTrigger && elapsed >= CATALOG_VISIBILITY_MIN_MS) return true;
  
  return false;
}

export function shouldRunOrdersPull({
  now,
  lastOrdersAt,
  visible,
  force,
}: {
  now: number;
  lastOrdersAt: number | null;
  visible: boolean;
  force?: boolean;
}): boolean {
  if (force) return true;
  if (!visible) return false;
  if (!lastOrdersAt) return true;
  
  return (now - lastOrdersAt) >= ORDERS_INTERVAL_MS;
}

export function shouldDrainOutbox({
  pendingCount,
  online,
  force,
}: {
  pendingCount: number;
  online: boolean;
  force?: boolean;
}): boolean {
  if (force) return online;
  if (!online) return false;
  return pendingCount > 0;
}
