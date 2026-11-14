"use server";

import { createClient } from "@/lib/supabase/server";
import { CatalogItem, CatalogItemRequirement } from "@/app/types";
import { z } from "zod";

/**
 * Ensure a durable 1:1:1 catalog_item ↔ requirement ↔ instance link.
 * Reuses the existing triad so robot process context is not cut.
 */
export async function ensureCatalogItemRequirement(
  catalogItemId: string
): Promise<{ data?: CatalogItemRequirement; error?: string }> {
  if (!z.string().uuid().safeParse(catalogItemId).success) {
    return { error: "Catalog quoting context unavailable" };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Authentication required" };

  const { data, error } = await supabase.rpc("ensure_catalog_item_requirement", {
    p_catalog_item_id: catalogItemId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { error: "Catalog quoting context unavailable" };
  }
  const result = data as { data?: CatalogItemRequirement; error?: string };
  if (result.error || !result.data) return { error: "Catalog quoting context unavailable" };
  return { data: result.data };
}

export async function getCatalogItemRequirement(
  catalogItemId: string
): Promise<{ data?: CatalogItemRequirement | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_item_requirements")
    .select("*")
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { data: (data as CatalogItemRequirement) || null };
}

export async function ensureCatalogItemRequirementForItem(
  item: Pick<CatalogItem, "id">
) {
  return ensureCatalogItemRequirement(item.id);
}
