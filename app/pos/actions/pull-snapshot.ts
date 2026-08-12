"use server";

import { createClient } from "@/lib/supabase/server";
import { listCatalogItems, listCatalogCategories } from "@/app/catalog/actions";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { listLocations } from "@/app/inventory/actions";
import { getLeads } from "@/app/leads/actions";
import { listOrders } from "@/app/orders/actions";
import { listPriceLists } from "@/app/price-lists/actions";
import { isPriceListAllowedForChannel } from "@/app/price-lists/price-list-channels";
import {
  listPromotions,
  listPromotionItems,
  listPromotionCategories,
  listPromotionRequiredItems,
  listPromotionRequiredCategories,
} from "@/app/promotions/actions";
import { isPromotionAllowedForChannel } from "@/app/promotions/promotion-channels";
import { listAllModifierGroupsForPos } from "@/app/catalog/modifier-actions";

export type PosSnapshot = {
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
  pendingOrders: any[];
  modifierGroupsByHostId: Record<string, any[]>;
  pulledAt: string;
};

export async function pullPosSnapshot(siteId: string): Promise<
  { data: PosSnapshot } | { error: string }
> {
  try {
    if (!siteId) return { error: "siteId is required" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const [
      catalogRes,
      categoriesRes,
      locationsRes,
      leadsRes,
      priceListsRes,
      pendingRes,
      unpaidRes,
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
      getLeads(siteId),
      listPriceLists({ siteId, pageSize: 100 }),
      listOrders({ siteId, status: "pending,in_progress", pageSize: 50 }),
      listOrders({
        siteId,
        status: "completed",
        paymentStatus: "unpaid",
        pageSize: 50,
      }),
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

    let priceListItems: PosSnapshot["priceListItems"] = [];
    if (priceListIds.length > 0) {
      const { data: pli } = await supabase
        .from("price_list_items")
        .select("id, price_list_id, catalog_item_id, unit_price")
        .in("price_list_id", priceListIds);
      priceListItems = (pli || []) as PosSnapshot["priceListItems"];
    }

    const posPromos = (promotionsRes?.data || []).filter((promo: any) =>
      isPromotionAllowedForChannel(promo.channels, "pos"),
    );
    const promotions = await Promise.all(
      posPromos.map(async (promo: any) => {
        const [itemsRes, catsRes, reqRes, reqCatsRes] = await Promise.all([
          listPromotionItems(promo.id, siteId),
          listPromotionCategories(promo.id, siteId),
          listPromotionRequiredItems(promo.id, siteId),
          listPromotionRequiredCategories(promo.id, siteId),
        ]);
        return {
          ...promo,
          catalog_item_ids: (itemsRes?.data || []).map(
            (r: any) => r.catalog_item_id,
          ),
          category_ids: (catsRes?.data || []).map(
            (r: any) => r.catalog_category_id,
          ),
          required_items: (reqRes?.data || []).map(
            (r: any) => ({ catalog_item_id: r.catalog_item_id, min_quantity: r.min_quantity })
          ),
          required_categories: (reqCatsRes?.data || []).map(
            (r: any) => ({
              catalog_category_id: r.catalog_category_id,
              min_quantity: r.min_quantity,
            })
          ),
        };
      }),
    );

    const pendingOrders = [
      ...(pendingRes?.data || []),
      ...(unpaidRes?.data || []),
    ].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const modifiersRes = await listAllModifierGroupsForPos(siteId);

    return {
      data: {
        catalogItems,
        categories: categoriesRes?.data || [],
        locations: locationsRes?.data || [],
        leads: leadsRes?.leads || [],
        priceLists: activePriceLists,
        priceListItems,
        taxesByItem: taxesRes?.data || {},
        promotions,
        pendingOrders,
        modifierGroupsByHostId: modifiersRes.data || {},
        pulledAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return { error: error?.message || "Failed to pull POS snapshot" };
  }
}
