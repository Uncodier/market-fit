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
  pulledAt: string;
  /** When false, IndexedDB keeps existing synced leads. */
  replaceLeads?: boolean;
};

export async function pullPosCatalogSnapshot(
  siteId: string,
  revision?: string | null,
): Promise<
  { data: PosCatalogSnapshot } | { error: string }
> {
  try {
    const access = await requirePosSiteAccess(siteId);
    if (!("supabase" in access)) return { error: access.error };
    const { supabase } = access;
    const cacheIdentity = await hashRedisKeyPart(
      `${siteId}:${revision || "latest"}`,
    );

    const cached = await readThroughJsonCache<PosCatalogSnapshot>({
      key: `cache:v1:pos-catalog-snapshot:${cacheIdentity}`,
      ttlSeconds: revision ? 300 : 30,
      lockTtlMs: 30_000,
      compute: async () => {
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

        const catalogItems = catalogRes?.data || [];
        const catalogIds = catalogItems.map((i: any) => i.id);
        const taxesRes = await getTaxesByCatalogItemIds(siteId, catalogIds);

        const activePriceLists = (priceListsRes?.data || []).filter(
          (pl: any) =>
            pl.is_active && isPriceListAllowedForChannel(pl.channels, "pos"),
        );
        const priceListIds = activePriceLists.map((pl: any) => pl.id);

        let priceListItems: PosCatalogSnapshot["priceListItems"] = [];
        if (priceListIds.length > 0) {
          const { data: pli } = await supabase
            .from("price_list_items")
            .select("id, price_list_id, catalog_item_id, unit_price")
            .in("price_list_id", priceListIds);
          priceListItems = (pli || []) as PosCatalogSnapshot["priceListItems"];
        }

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

          promotions = posPromos.map((promo: any) => ({
            ...promo,
            catalog_item_ids: (itemsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => row.catalog_item_id),
            category_ids: (catsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => row.catalog_category_id),
            required_items: (reqItemsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => ({ catalog_item_id: row.catalog_item_id, min_quantity: row.min_quantity })),
            required_categories: (reqCatsRes.data || []).filter((row: any) => row.promotion_id === promo.id).map((row: any) => ({ catalog_category_id: row.catalog_category_id, min_quantity: row.min_quantity })),
          }));
        }

        const modifiersRes = await listAllModifierGroupsForPos(siteId);

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
      },
    });

    if (cached.status === "busy") {
      return { error: "Catalog snapshot is being refreshed" };
    }
    return { data: cached.value };
  } catch (error: any) {
    return { error: error?.message || "Failed to pull POS catalog snapshot" };
  }
}
