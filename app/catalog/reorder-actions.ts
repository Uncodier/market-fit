"use server";

import { createClient } from "@/lib/supabase/server";

export interface ReorderCatalogPayload {
  siteId: string;
  categoryIds: string[];
  itemIdsByCategory: Record<string, string[]>;
}

/**
 * Persists the grouped catalog order.
 * Updates the sort_order of categories, and then for each category in order,
 * assigns sequential sort_order to its items and updates their category_id.
 */
export async function reorderCatalogDisplay({
  siteId,
  categoryIds,
  itemIdsByCategory,
}: ReorderCatalogPayload) {
  try {
    const supabase = await createClient();

    // 1. Update categories
    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      if (catId === "uncategorized") continue;
      
      const { error } = await supabase
        .from("catalog_categories")
        .update({ sort_order: i })
        .eq("id", catId)
        .eq("site_id", siteId);

      if (error) {
        console.error("Error updating category sort_order:", error);
        return { error: error.message };
      }
    }

    // 2. Update items with global sequential sort_order
    let currentItemSortOrder = 0;

    for (const catId of categoryIds) {
      const items = itemIdsByCategory[catId] || [];
      const isUncategorized = catId === "uncategorized";
      const dbCategoryId = isUncategorized ? null : catId;

      for (const itemId of items) {
        const { error } = await supabase
          .from("catalog_items")
          .update({
            sort_order: currentItemSortOrder,
            category_id: dbCategoryId,
          })
          .eq("id", itemId)
          .eq("site_id", siteId);

        if (error) {
          console.error("Error updating item sort_order/category_id:", error);
          return { error: error.message };
        }

        currentItemSortOrder++;
      }
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
