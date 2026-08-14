"use server";

import { createClient } from "@/lib/supabase/server";
import type { RedeemAssignmentMode } from "@/app/commerce/pass-round-robin";

export async function getPassRedeemableItems(passCatalogItemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pass_redeemable_items")
    .select("reservable_catalog_item_id, sort_order")
    .eq("pass_catalog_item_id", passCatalogItemId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data.map((d) => d.reservable_catalog_item_id);
}

export async function updatePassRedeemableItems(
  siteId: string,
  passCatalogItemId: string,
  reservableCatalogItemIds: string[]
) {
  const supabase = await createClient();

  // Remove existing
  const { error: delError } = await supabase
    .from("pass_redeemable_items")
    .delete()
    .eq("pass_catalog_item_id", passCatalogItemId);
  if (delError) throw new Error(delError.message);

  if (reservableCatalogItemIds.length > 0) {
    const { error: insError } = await supabase
      .from("pass_redeemable_items")
      .insert(
        reservableCatalogItemIds.map((id, index) => ({
          site_id: siteId,
          pass_catalog_item_id: passCatalogItemId,
          reservable_catalog_item_id: id,
          sort_order: index,
        }))
      );
    if (insError) throw new Error(insError.message);
  }

  return { success: true };
}

export async function updatePassAssignmentMode(
  siteId: string,
  passCatalogItemId: string,
  mode: RedeemAssignmentMode
) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    redeem_assignment_mode: mode,
    updated_at: new Date().toISOString(),
  };
  if (mode === "round_robin") {
    patch.is_reservation = true;
  }

  const { error } = await supabase
    .from("catalog_items")
    .update(patch)
    .eq("id", passCatalogItemId)
    .eq("site_id", siteId);

  if (error) return { error: new Error(error.message) };
  return { success: true };
}
