"use server"

import { unstable_cache } from "next/cache";
import { getSiteInfoBySlug } from "@/app/book/actions";
import { listPublicLocations } from "@/app/inventory/actions";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildShopCategoryOffsets,
  SHOP_CACHE_REVALIDATE_SECONDS,
  SHOP_PAGE_SIZE,
  SHOP_UNCATEGORIZED_NAME,
  shopCacheTag,
  shopSlugCacheTag,
  type ShopCategoryOffset,
} from "./shop-catalog-shared";
import { loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices";
import { loadVariantListingPreviews } from "@/app/catalog/variant-resolve";

/** Keep getShopCatalog + getShopCategoryOffsets on the same key order. */
function applyShopCatalogOrder<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order("sort_order", {
      foreignTable: "category",
      ascending: true,
      nullsFirst: false,
    })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    // Stable tiebreaker so range() pages cannot skip/duplicate rows.
    .order("id", { ascending: true });
}

export async function getShopSite(slug: string) {
  return unstable_cache(
    async () => getSiteInfoBySlug(slug),
    ["shop-site", slug],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopSlugCacheTag(slug)],
    }
  )();
}

function categoryNameFromJoin(category: unknown): string | null {
  const cat = Array.isArray(category) ? category[0] : category;
  return (cat as { name?: string | null } | null)?.name || null;
}

async function enrichShopItems(siteId: string, items: any[], supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const [priceData, levelsRes, settingsRes, variantPreviews, siteRes] = await Promise.all([
    loadChannelPriceMap(supabase, [siteId], "shop"),
    supabase.from("inventory_levels").select("catalog_item_id, quantity").eq("site_id", siteId),
    supabase.from("settings").select("commerce").eq("site_id", siteId).single(),
    loadVariantListingPreviews(
      supabase,
      items.map((item) => ({ id: item.id, name: item.name }))
    ),
    supabase.from("sites").select("description").eq("id", siteId).maybeSingle(),
  ]);

  const inventoryMap = new Map<string, number>();
  for (const level of levelsRes.data || []) {
    inventoryMap.set(
      level.catalog_item_id,
      (inventoryMap.get(level.catalog_item_id) || 0) + Number(level.quantity)
    );
  }

  const policy = (settingsRes.data?.commerce as any)?.stock_shortage_policy || "allow";
  const siteDescription = siteRes.data?.description || null;

  return items.map((item) => {
    let sellable = true;
    let availableQty: number | undefined;

    if (item.availability_mode === "manual") {
      sellable = item.availability_status === "available";
    } else if (item.availability_mode === "inventory") {
      availableQty = inventoryMap.get(item.id) || 0;
      sellable = availableQty > 0 || policy !== "block";
    }

    const preview = variantPreviews.get(item.id)
    const hasVariants =
      Boolean(preview?.hasVariants) ||
      Boolean(item.metadata?.variant_axes?.length && item.is_purchasable === false);

    const mappedPrice = priceData.priceByItemId.get(item.id);
    return {
      ...item,
      currency:
        item.currency || priceData.currencyBySiteId.get(siteId) || "USD",
      item_specs: ((item as any).raw_specs || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((cis: any) => cis.item_spec)
        .filter(Boolean),
      target_sale_price: mappedPrice ?? item.target_sale_price,
      _shop: {
        categoryName: categoryNameFromJoin(item.category),
        siteDescription,
        sellable,
        availableQty,
        hasVariants,
        variantLabels: preview?.labels || [],
      },
    };
  });
}

export async function getShopCategoryOffsets(siteId: string): Promise<ShopCategoryOffset[]> {
  return unstable_cache(
    async () => {
      const supabase = await createServiceClient(true);

      // Same order as getShopCatalog so range() jumps land on category starts.
      const { data: rows, error } = await applyShopCatalogOrder(
        supabase
          .from("catalog_items")
          .select("category:catalog_categories(name, sort_order)")
          .eq("site_id", siteId)
          .eq("status", "active")
          .eq("is_marketplace_listed", true)
          .is("parent_id", null)
      );

      if (error || !rows) return [];

      const names = rows.map(
        (row) => categoryNameFromJoin((row as any).category) || SHOP_UNCATEGORIZED_NAME
      );
      return buildShopCategoryOffsets(names);
    },
    // v3: stable id tiebreaker + full per-category counts
    ["shop-category-offsets-v3", siteId],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )();
}

export async function getShopCategories(siteId: string) {
  const offsets = await getShopCategoryOffsets(siteId);
  return offsets
    .map((o) => o.name)
    .filter((name) => name !== SHOP_UNCATEGORIZED_NAME);
}

export async function getShopCatalog(
  siteId: string,
  options: {
    page?: number
    pageSize?: number
    offset?: number
    search?: string
    category?: string
  } = {}
) {
  const {
    pageSize = SHOP_PAGE_SIZE,
    search = "",
    category = "all",
  } = options;
  const offset =
    typeof options.offset === "number"
      ? Math.max(0, options.offset)
      : Math.max(0, ((options.page || 1) - 1) * pageSize);
  const page = Math.floor(offset / pageSize) + 1;

  return unstable_cache(
    async () => {
      const supabase = await createServiceClient(true);

      let query = supabase
        .from("catalog_items")
        .select(
          `
      *,
      category:catalog_categories(name, sort_order),
      raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
    `,
          { count: "exact" }
        )
        .eq("site_id", siteId)
        .eq("status", "active")
        .eq("is_marketplace_listed", true)
        .is("parent_id", null);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      if (category !== "all" && category !== SHOP_UNCATEGORIZED_NAME) {
        const { data: cats } = await supabase
          .from("catalog_categories")
          .select("id")
          .eq("site_id", siteId)
          .eq("name", category);
        const catIds = (cats || []).map((c: { id: string }) => c.id);
        if (catIds.length === 0) {
          return { data: [], count: 0, totalPages: 0, page, pageSize, offset };
        }
        query = query.in("category_id", catIds);
      } else if (category === SHOP_UNCATEGORIZED_NAME) {
        query = query.is("category_id", null);
      }

      const from = offset;
      const to = offset + pageSize - 1;

      query = applyShopCatalogOrder(query).range(from, to);

      const { data: items, count, error } = await query;

      if (error || !items) {
        return { data: [], count: 0, totalPages: 0, page, pageSize, offset, error: error?.message };
      }

      const enrichedItems = await enrichShopItems(siteId, items, supabase);

      return {
        data: enrichedItems,
        count: count || 0,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
        page,
        pageSize,
        offset,
      };
    },
    // v3: stable id tiebreaker for range pagination
    ["shop-catalog-v3", siteId, String(offset), String(pageSize), search, category],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )();
}

export async function getShopItemsByIds(siteId: string, ids: string[]) {
  if (!ids || ids.length === 0) return { data: [] };
  const sortedIds = [...ids].sort();

  const cached = await unstable_cache(
    async () => {
      const supabase = await createServiceClient(true);

      const { data: items, error } = await supabase
        .from("catalog_items")
        .select(`
      *,
      category:catalog_categories(name),
      raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
    `)
        .eq("site_id", siteId)
        .in("id", sortedIds);

      if (error || !items) return { data: [] as any[], error: error?.message };

      const enriched = await enrichShopItems(siteId, items, supabase);
      return { data: enriched, error: undefined as string | undefined };
    },
    ["shop-items-by-ids", siteId, sortedIds.join(",")],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )();

  const byId = new Map(cached.data.map((item: any) => [item.id, item]));
  return {
    data: ids.map((id) => byId.get(id)).filter(Boolean),
    error: cached.error,
  };
}

export type ShopOwnedAccess = {
  catalogItemId: string;
  canBook: boolean;
};

export async function getShopUserOwnedItems(siteId: string): Promise<ShopOwnedAccess[]> {
  const { createClient } = await import("@/lib/supabase/server");
  // Always skip demo: shop is a real commerce surface and the demo mock
  // client breaks / loops when mixed with live site IDs.
  const supabase = await createClient(true);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();
  
  // 1. Get active entitlements (excluding those granted by subscriptions since the subscription itself is shown)
  const { data: entitlements } = await supabase
    .from('entitlements')
    .select('catalog_item_id')
    .eq('site_id', siteId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .neq('source_type', 'subscription')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`uses_remaining.is.null,uses_remaining.gt.0`);
    
  // 2. Get active subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('catalog_item_id')
    .eq('site_id', siteId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active');
    
  const ownedIds = new Set<string>();
  entitlements?.forEach((e: any) => ownedIds.add(e.catalog_item_id!));
  subscriptions?.forEach((s: any) => ownedIds.add(s.catalog_item_id!));
  
  const ownedArray = Array.from(ownedIds);
  if (ownedArray.length === 0) return [];

  // Direct: owned catalog items that are themselves reservable (plan-as-calendar / owned service)
  const { data: ownedCatalog } = await supabase
    .from('catalog_items')
    .select('id, is_reservation')
    .in('id', ownedArray);

  const reservableOwned = new Set(
    (ownedCatalog || []).filter((c: any) => c.is_reservation).map((c: any) => c.id)
  );

  // Plans → passes they grant (pass may or may not already be in ownedArray)
  const { data: planItems } = await supabase
    .from('subscription_plan_items')
    .select('plan_catalog_item_id, digital_catalog_item_id')
    .in('plan_catalog_item_id', ownedArray);

  const planPassIds = (planItems || [])
    .map((pi: any) => pi.digital_catalog_item_id)
    .filter(Boolean);

  const passIdsToCheck = Array.from(new Set([...ownedArray, ...planPassIds]));

  // Indirect: passes with at least one redeemable (calendar on plan or another service)
  const { data: passRedeemables } = await supabase
    .from('pass_redeemable_items')
    .select('pass_catalog_item_id')
    .in('pass_catalog_item_id', passIdsToCheck);

  const passesWithRedeemables = new Set(
    (passRedeemables || []).map((r: any) => r.pass_catalog_item_id)
  );

  const plansWithBookablePasses = new Set<string>();
  (planItems || []).forEach((pi: any) => {
    if (passesWithRedeemables.has(pi.digital_catalog_item_id)) {
      plansWithBookablePasses.add(pi.plan_catalog_item_id);
    }
  });

  return ownedArray.map(id => ({
    catalogItemId: id,
    canBook:
      reservableOwned.has(id) ||
      passesWithRedeemables.has(id) ||
      plansWithBookablePasses.has(id),
  }));
}

export async function getShopLocations(siteId: string) {
  return unstable_cache(
    async () => listPublicLocations(siteId),
    ["shop-locations", siteId],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )();
}
