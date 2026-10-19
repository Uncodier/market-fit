"use server";

import { createClient } from "@/lib/supabase/server";
import type { CatalogCategory } from "@/app/types";

/** The listing needs only a bounded set of categories, not every site category. */
export async function listCatalogPageCategories(
  siteId: string,
  categoryIds: string[],
  includeEmpty: boolean,
) {
  const ids = [...new Set(categoryIds)].slice(0, 50);
  if (!includeEmpty && !ids.length) return { data: [], complete: false };
  try {
    const supabase = await createClient();
    const query = () => supabase.from("catalog_categories")
      .select("*", { count: "exact" }).eq("site_id", siteId)
      .order("sort_order", { ascending: true }).order("name", { ascending: true })
      .order("id", { ascending: true });

    if (includeEmpty) {
      const { data, count, error } = await query().or("status.eq.active,status.is.null").range(0, 49);
      if (error) return { data: [], complete: false, error: "Failed to load catalog categories" };
      // Only expose empty sections/reordering if every category fits on this page.
      if (count !== null && count <= 50 && count <= (data?.length ?? 0) &&
          ids.every(id => (data || []).some((category: CatalogCategory) => category.id === id))) {
        return { data: (data || []) as CatalogCategory[], complete: true };
      }
    }
    if (!ids.length) return { data: [], complete: false };
    const { data, error } = await query().in("id", ids).range(0, 49);
    if (error) return { data: [], complete: false, error: "Failed to load catalog categories" };
    return { data: (data || []) as CatalogCategory[], complete: false };
  } catch {
    return { data: [], complete: false, error: "Failed to load catalog categories" };
  }
}