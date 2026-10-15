import type { CatalogItem } from "@/app/types";
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types";

/** The POS snapshot includes hidden variant SKUs as well as grid listings. */
export function getPosItemChildren(item: CatalogItem, catalogItems: CatalogItem[]) {
  return catalogItems.filter((child) =>
    child.parent_id === item.id && child.status === "active" && child.is_purchasable !== false,
  );
}

/** Missing hosts in a complete snapshot mean no extras, not a cache miss. */
export function getPosItemModifierGroups(
  item: CatalogItem,
  groupsByHostId: Record<string, ModifierGroupWithItems[]>,
): ModifierGroupWithItems[] {
  for (const hostId of [item.id, item.parent_id]) {
    if (hostId && groupsByHostId[hostId]?.length) return groupsByHostId[hostId];
  }
  return [];
}