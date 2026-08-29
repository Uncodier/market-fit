import { unstable_cache } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  SHOP_CACHE_REVALIDATE_SECONDS,
  shopCacheTag,
} from "@/app/shop/[siteSlug]/shop-catalog-shared";
import type { MerchandisingPromotion } from "./promotion-availability";
import {
  placeMarketplaceMerchandising,
  placeShopMerchandising,
  type MarketplaceMerchandisingPlacement,
  type ShopMerchandisingPlacement,
} from "./promotion-merchandising";

async function loadSitePromotions(siteId: string, forceService = false) {
  const supabase = forceService
    ? await createServiceClient(true)
    : await createClient();

  const { data: promos, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "active");

  if (error || !promos?.length) {
    return { promotions: [] as MerchandisingPromotion[], error: error?.message };
  }

  const ids = promos.map((p: any) => p.id);
  const [{ data: items }, { data: cats }] = await Promise.all([
    supabase
      .from("promotion_catalog_items")
      .select("promotion_id, catalog_item_id")
      .in("promotion_id", ids),
    supabase
      .from("promotion_catalog_categories")
      .select("promotion_id, catalog_category_id")
      .in("promotion_id", ids),
  ]);

  const itemsByPromo = new Map<string, string[]>();
  for (const row of items || []) {
    const list = itemsByPromo.get(row.promotion_id) || [];
    list.push(row.catalog_item_id);
    itemsByPromo.set(row.promotion_id, list);
  }

  const catsByPromo = new Map<string, string[]>();
  for (const row of cats || []) {
    const list = catsByPromo.get(row.promotion_id) || [];
    list.push(row.catalog_category_id);
    catsByPromo.set(row.promotion_id, list);
  }

  const promotions: MerchandisingPromotion[] = promos.map((p: any) => ({
    ...p,
    catalog_item_ids: itemsByPromo.get(p.id) || [],
    category_ids: catsByPromo.get(p.id) || [],
  }));

  return { promotions };
}

export async function getShopMerchandising(params: {
  siteId: string;
  siteSlug: string;
  timezone?: string | null;
}): Promise<
  ShopMerchandisingPlacement & {
    categoryPromosByName: Record<string, import("./promotion-merchandising").StorefrontPromoCard[]>;
  }
> {
  const timezoneKey = params.timezone || "";
  return unstable_cache(
    async () => {
      const { promotions } = await loadSitePromotions(params.siteId, true);
      const placement = placeShopMerchandising({
        promotions,
        timezone: params.timezone,
        hrefFor: (id) => `/shop/${params.siteSlug}/promo/${id}`,
      });

      const supabase = await createServiceClient(true);
      const { data: categories } = await supabase
        .from("catalog_categories")
        .select("id, name")
        .eq("site_id", params.siteId);

      const idToName = new Map<string, string>(
        (categories || []).map((c: any) => [String(c.id), String(c.name)]),
      );
      const categoryPromosByName: Record<
        string,
        import("./promotion-merchandising").StorefrontPromoCard[]
      > = {};
      for (const [catId, promos] of Object.entries(placement.byCategoryId)) {
        const name = idToName.get(String(catId));
        if (!name) continue;
        categoryPromosByName[name] = [
          ...(categoryPromosByName[name] || []),
          ...promos,
        ];
      }

      return { ...placement, categoryPromosByName };
    },
    ["shop-merchandising", params.siteId, params.siteSlug, timezoneKey],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(params.siteId)],
    }
  )();
}

async function loadMarketplaceMerchandisingUncached(params: {
  siteIds?: string[];
  timezone?: string | null;
}): Promise<MarketplaceMerchandisingPlacement> {
  const supabase = await createServiceClient(true);
  let query = supabase.from("promotions").select("*").eq("status", "active");
  if (params.siteIds?.length) {
    query = query.in("site_id", params.siteIds);
  }
  const { data: promos } = await query;
  if (!promos?.length) {
    return { discountsFeed: [], byItemId: {} };
  }

  const ids = promos.map((p: any) => p.id);
  const [{ data: items }, { data: cats }] = await Promise.all([
    supabase
      .from("promotion_catalog_items")
      .select("promotion_id, catalog_item_id")
      .in("promotion_id", ids),
    supabase
      .from("promotion_catalog_categories")
      .select("promotion_id, catalog_category_id")
      .in("promotion_id", ids),
  ]);

  const itemsByPromo = new Map<string, string[]>();
  for (const row of items || []) {
    const list = itemsByPromo.get(row.promotion_id) || [];
    list.push(row.catalog_item_id);
    itemsByPromo.set(row.promotion_id, list);
  }
  const catsByPromo = new Map<string, string[]>();
  for (const row of cats || []) {
    const list = catsByPromo.get(row.promotion_id) || [];
    list.push(row.catalog_category_id);
    catsByPromo.set(row.promotion_id, list);
  }

  const promotions: MerchandisingPromotion[] = promos.map((p: any) => ({
    ...p,
    catalog_item_ids: itemsByPromo.get(p.id) || [],
    category_ids: catsByPromo.get(p.id) || [],
  }));

  return placeMarketplaceMerchandising({
    promotions,
    timezone: params.timezone,
    hrefFor: (id) => `/marketplace/promo/${id}`,
  });
}

export async function getMarketplaceMerchandising(params: {
  siteIds?: string[];
  timezone?: string | null;
}): Promise<MarketplaceMerchandisingPlacement> {
  const siteKey = (params.siteIds || []).slice().sort().join(",") || "all";
  const timezoneKey = params.timezone || "";
  return unstable_cache(
    () => loadMarketplaceMerchandisingUncached(params),
    ["marketplace-merchandising", siteKey, timezoneKey],
    { revalidate: SHOP_CACHE_REVALIDATE_SECONDS },
  )();
}

export async function getStorefrontPromotionDetail(params: {
  promotionId: string;
  siteId?: string;
}) {
  const supabase = await createServiceClient(true);
  let query = supabase
    .from("promotions")
    .select("*")
    .eq("id", params.promotionId)
    .eq("status", "active");
  if (params.siteId) query = query.eq("site_id", params.siteId);

  const { data: promo, error } = await query.maybeSingle();
  if (error || !promo) return { error: error?.message || "Promotion not found" };

  const [
    { data: items },
    { data: cats },
    { data: requiredItems },
    { data: requiredCategories },
  ] = await Promise.all([
    supabase
      .from("promotion_catalog_items")
      .select("catalog_item_id")
      .eq("promotion_id", promo.id),
    supabase
      .from("promotion_catalog_categories")
      .select("catalog_category_id")
      .eq("promotion_id", promo.id),
    supabase
      .from("promotion_required_items")
      .select("catalog_item_id, min_quantity, catalog_items(id, name, image_url, target_sale_price, currency, category_id, status)")
      .eq("promotion_id", promo.id),
    supabase
      .from("promotion_required_categories")
      .select("catalog_category_id, min_quantity, catalog_categories(id, name)")
      .eq("promotion_id", promo.id),
  ]);

  let categoryPickItems: any[] = [];
  const reqCatIds = (requiredCategories || []).map((c: any) => c.catalog_category_id);
  if (reqCatIds.length > 0) {
    const { data: catItems } = await supabase
      .from("catalog_items")
      .select("id, name, image_url, target_sale_price, currency, category_id, status, site_id")
      .eq("site_id", promo.site_id)
      .in("category_id", reqCatIds)
      .eq("status", "active")
      .limit(40);
    categoryPickItems = catItems || [];
  }

  return {
    data: {
      ...promo,
      catalog_item_ids: (items || []).map((i: any) => i.catalog_item_id),
      category_ids: (cats || []).map((c: any) => c.catalog_category_id),
      required_items: (requiredItems || []).map((r: any) => ({
        catalog_item_id: r.catalog_item_id,
        min_quantity: r.min_quantity,
        item: Array.isArray(r.catalog_items) ? r.catalog_items[0] : r.catalog_items,
      })),
      required_categories: (requiredCategories || []).map((r: any) => ({
        catalog_category_id: r.catalog_category_id,
        min_quantity: r.min_quantity,
        category: Array.isArray(r.catalog_categories)
          ? r.catalog_categories[0]
          : r.catalog_categories,
      })),
      category_pick_items: categoryPickItems,
    },
  };
}
