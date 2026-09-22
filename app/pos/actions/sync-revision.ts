"use server";

import { hashRedisKeyPart } from "@/lib/redis/control-plane";
import { readThroughJsonCache } from "@/lib/redis/json-cache";
import { requirePosSiteAccess } from "./site-access";

export async function getPosCatalogRevision(siteId: string): Promise<{ data: string } | { error: string }> {
  try {
    const access = await requirePosSiteAccess(siteId);
    if (!("supabase" in access)) return { error: access.error };
    const siteHash = await hashRedisKeyPart(siteId);

    const cached = await readThroughJsonCache({
      key: `cache:v1:pos-catalog-revision:${siteHash}`,
      ttlSeconds: 20,
      lockTtlMs: 10_000,
      compute: async () => {
        const [
          { data: items },
          { count: itemsCount },
          { data: categories },
          { count: categoriesCount },
          { data: priceLists },
          { count: priceListsCount },
          { data: promotions },
          { count: promotionsCount },
        ] = await Promise.all([
          access.supabase.from("catalog_items").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
          access.supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("site_id", siteId),
          access.supabase.from("catalog_categories").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
          access.supabase.from("catalog_categories").select("id", { count: "exact", head: true }).eq("site_id", siteId),
          access.supabase.from("price_lists").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
          access.supabase.from("price_lists").select("id", { count: "exact", head: true }).eq("site_id", siteId),
          access.supabase.from("promotions").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
          access.supabase.from("promotions").select("id", { count: "exact", head: true }).eq("site_id", siteId),
        ]);

        return [
          `${items?.[0]?.updated_at || "0"}:${itemsCount ?? 0}`,
          `${categories?.[0]?.updated_at || "0"}:${categoriesCount ?? 0}`,
          `${priceLists?.[0]?.updated_at || "0"}:${priceListsCount ?? 0}`,
          `${promotions?.[0]?.updated_at || "0"}:${promotionsCount ?? 0}`,
        ].join("|");
      },
    });

    if (cached.status === "busy") {
      return { error: "Catalog revision is being refreshed" };
    }
    return { data: cached.value };
  } catch (error: any) {
    return { error: error?.message || "Failed to fetch catalog revision" };
  }
}
