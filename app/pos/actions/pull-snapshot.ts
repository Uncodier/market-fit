"use server";

import { listCatalogItems, listCatalogCategories } from "@/app/catalog/actions";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { listLocations } from "@/app/inventory/actions";
import { listPriceLists } from "@/app/price-lists/actions";
import { listAllModifierGroupsForPos } from "@/app/catalog/modifier-actions";
import { isPriceListAllowedForChannel } from "@/app/price-lists/price-list-channels";
import { listPromotions } from "@/app/promotions/actions";
import { isPromotionAllowedForChannel } from "@/app/promotions/promotion-channels";
import { hashRedisKeyPart } from "@/lib/redis/control-plane";
import { readThroughJsonCache } from "@/lib/redis/json-cache";
import { requirePosSiteAccess } from "./site-access";
import { pullPosInventorySnapshot } from "./inventory-snapshot";
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability";
import { readPosPriceListItems } from "./price-list-snapshot";

export type PosCatalogSnapshot = {
  catalogItems: any[];
  categories: any[];
  locations: any[];
  leads: any[];
  priceLists: any[];
  priceListItems: {
    id: string;
    price_list_id: string;
    catalog_item_id: string;
    unit_price: number;
  }[];
  taxesByItem: Record<string, any[]>;
  promotions: any[];
  modifierGroupsByHostId: Record<string, any[]>;
  inventorySnapshot: PosInventorySnapshot;
  pulledAt: string;
  /** When false, IndexedDB keeps existing synced leads. */
  replaceLeads?: boolean;
};

export async function pullPosCatalogSnapshot(
  siteId: string,
  revision?: string | null,
  bypassCache = false,
): Promise<
  { data: PosCatalogSnapshot } | { error: string }
> {
  if (typeof siteId !== "string" || !siteId.trim()) return { error: "siteId is required" };
  try {
    const access = await requirePosSiteAccess(siteId);
    if (!("supabase" in access)) return { error: access.error };
    const { supabase } = access;
    const compute = async (): Promise<Omit<PosCatalogSnapshot, "inventorySnapshot">> => {
        const [
          catalogRes,
          categoriesRes,
          locationsRes,
          priceListsRes,
          promotionsRes,
        ] = await Promise.all([
          listCatalogItems({
            siteId,
            status: "active",
            isPosAvailable: true,
            pageSize: 500,
          }),
          listCatalogCategories(siteId),
          listLocations(siteId),
          listPriceLists({ siteId, pageSize: 100 }),
          listPromotions({ siteId, status: "active", pageSize: 100 }),
        ]);

        if ([catalogRes, categoriesRes, locationsRes, priceListsRes, promotionsRes].some((result) => result.error)) {
          throw new Error("Failed to load POS catalog data");
        }

        const catalogItems = [...(catalogRes?.data || [])];
        for (let page = 2; catalogItems.length < catalogRes.count; page += 1) {
          const result = await listCatalogItems({ siteId, status: "active", isPosAvailable: true, pageSize: 500, page });
          if (result.error || !result.data.length) throw new Error("Failed to load POS catalog page");
          catalogItems.push(...result.data);
        }
        const catalogIds = new Set(catalogItems.map((item) => item.id));

        const allPriceLists = [...(priceListsRes?.data || [])];
        for (let page = 2; allPriceLists.length < priceListsRes.count; page += 1) {
          const result = await listPriceLists({ siteId, pageSize: 100, page });
          if (result.error || !result.data.length) throw new Error("Failed to load POS price list page");
          allPriceLists.push(...result.data);
        }
        const activePriceLists = allPriceLists.filter(
          (pl: any) =>
            pl.is_active && isPriceListAllowedForChannel(pl.channels, "pos"),
        );
        const priceListIds = activePriceLists.map((pl: any) => pl.id);

        const priceListItems = await readPosPriceListItems(supabase, siteId, priceListIds);

        const posPromos = (promotionsRes?.data || []).filter((promo: any) =>
          isPromotionAllowedForChannel(promo.channels, "pos"),
        );
    
        let promotions = posPromos;
        if (posPromos.length > 0) {
          const promoIds = posPromos.map((p: any) => p.id);
      
          const [itemsRes, catsRes, reqItemsRes, reqCatsRes] = await Promise.all([
            supabase.from("promotion_catalog_items").select("promotion_id, catalog_item_id").in("promotion_id", promoIds).eq("site_id", siteId),
            supabase.from("promotion_catalog_categories").select("promotion_id, catalog_category_id").in("promotion_id", promoIds).eq("site_id", siteId),
            supabase.from("promotion_required_items").select("promotion_id, catalog_item_id, min_quantity").in("promotion_id", promoIds).eq("site_id", siteId),
            supabase.from("promotion_required_categories").select("promotion_id, catalog_category_id, min_quantity").in("promotion_id", promoIds).eq("site_id", siteId),
          ]);
          if ([itemsRes, catsRes, reqItemsRes, reqCatsRes].some((result) => result.error)) {
            throw new Error("Failed to load POS promotion details");
          }

          promotions = posPromos.map((promo: any) => ({
            ...promo,
            catalog_item_ids: (itemsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => row.catalog_item_id),
            category_ids: (catsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => row.catalog_category_id),
            required_items: (reqItemsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => ({ catalog_item_id: row.catalog_item_id, min_quantity: row.min_quantity })),
            required_categories: (reqCatsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => ({ catalog_category_id: row.catalog_category_id, min_quantity: row.min_quantity })),
          }));
        }

        const modifiersRes = await listAllModifierGroupsForPos(siteId);
        if (modifiersRes.error) throw new Error("Failed to load POS modifiers");
        const modifierIds = Array.from(new Set(
          Object.values(modifiersRes.data || {}).flatMap((groups) =>
            groups.flatMap((group) => group.items.map((option) => option.catalog_item_id)),
          ),
        )).filter((id) => !catalogIds.has(id));
        // Modifier SKUs can be hidden from the POS grid, but still need stock checks.
        for (let offset = 0; offset < modifierIds.length; offset += 100) {
          const { data, error } = await supabase
            .from("catalog_items")
            .select("*")
            .eq("site_id", siteId)
            .in("id", modifierIds.slice(offset, offset + 100));
          if (error || !data) throw new Error("Failed to load POS modifier items");
          catalogItems.push(...data);
          data.forEach((item: { id: string }) => catalogIds.add(item.id));
        }

        // A hidden child SKU is still selectable through its POS parent.
        const parentIds = catalogItems.filter((item) => !item.parent_id).map((item) => item.id);
        for (let batch = 0; batch < parentIds.length; batch += 100) {
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase.from("catalog_items").select("*")
              .eq("site_id", siteId).eq("status", "active").eq("is_purchasable", true)
              .in("parent_id", parentIds.slice(batch, batch + 100))
              .order("id", { ascending: true }).range(offset, offset + 999);
            if (error || !Array.isArray(data)) throw new Error("Failed to load POS variants");
            for (const item of data) {
              if (!catalogIds.has(item.id)) catalogItems.push(item);
              catalogIds.add(item.id);
            }
            if (data.length < 1000) break;
          }
        }
        const taxesRes = await getTaxesByCatalogItemIds(siteId, [...catalogIds]);
        if (taxesRes.error) throw new Error("Failed to load POS catalog taxes");

        return {
          catalogItems,
          categories: categoriesRes?.data || [],
          locations: locationsRes?.data || [],
          leads: [],
          replaceLeads: false,
          priceLists: activePriceLists,
          priceListItems,
          taxesByItem: taxesRes?.data || {},
          promotions,
          modifierGroupsByHostId: modifiersRes.data || {},
          pulledAt: new Date().toISOString(),
        };
    };

    // Recovery must read fresh data but retain the observed revision locally,
    // so the next lightweight check cannot replace it with an older cached row.
    const catalogRead = async () => bypassCache || revision === null
      ? { status: "computed" as const, value: await compute() }
      : readThroughJsonCache<Omit<PosCatalogSnapshot, "inventorySnapshot">>({
          key: `cache:v2:pos-catalog-snapshot:${await hashRedisKeyPart(`${siteId}:${revision || "latest"}`)}`,
          ttlSeconds: revision ? 300 : 30,
          lockTtlMs: 30_000,
          compute,
        });

    // Independent inventory and catalog reads can overlap on the server. Wait
    // for both to settle: neither a partial snapshot nor an early rejected
    // sibling may be published as a successful download.
    const [catalogResult, inventoryResult] = await Promise.allSettled([
      catalogRead(), pullPosInventorySnapshot(siteId),
    ]);
    if (catalogResult.status === "rejected") throw catalogResult.reason;
    if (inventoryResult.status === "rejected") throw inventoryResult.reason;
    const cached = catalogResult.value;
    const inventory = inventoryResult.value;

    if (cached.status === "busy") {
      return { error: "Catalog snapshot is being refreshed" };
    }
    if ("error" in inventory) return { error: inventory.error };
    return {
      data: {
        ...cached.value,
        inventorySnapshot: inventory.data,
        pulledAt: new Date().toISOString(),
      },
    };
  } catch {
    return { error: "Failed to pull POS catalog snapshot" };
  }
}
