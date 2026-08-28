"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPosCatalogRevision(siteId: string): Promise<{ data: string } | { error: string }> {
  try {
    if (!siteId) return { error: "siteId is required" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const [
      { data: items },
      { count: itemsCount },
      { data: categories },
      { count: categoriesCount },
      { data: priceLists },
      { count: priceListsCount },
      { data: promotions },
      { count: promotionsCount },
      { data: leads },
      { count: leadsCount },
    ] = await Promise.all([
      supabase.from("catalog_items").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("site_id", siteId),
      supabase.from("catalog_categories").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("catalog_categories").select("id", { count: "exact", head: true }).eq("site_id", siteId),
      supabase.from("price_lists").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("price_lists").select("id", { count: "exact", head: true }).eq("site_id", siteId),
      supabase.from("promotions").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("promotions").select("id", { count: "exact", head: true }).eq("site_id", siteId),
      supabase.from("leads").select("updated_at").eq("site_id", siteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    ]);

    const parts = [
      `${items?.[0]?.updated_at || "0"}:${itemsCount ?? 0}`,
      `${categories?.[0]?.updated_at || "0"}:${categoriesCount ?? 0}`,
      `${priceLists?.[0]?.updated_at || "0"}:${priceListsCount ?? 0}`,
      `${promotions?.[0]?.updated_at || "0"}:${promotionsCount ?? 0}`,
      `${leads?.[0]?.updated_at || "0"}:${leadsCount ?? 0}`,
    ];

    return { data: parts.join("|") };
  } catch (error: any) {
    return { error: error?.message || "Failed to fetch catalog revision" };
  }
}
