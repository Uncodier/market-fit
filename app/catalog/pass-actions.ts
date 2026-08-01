"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPassRedeemableItems(passCatalogItemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pass_redeemable_items")
    .select("reservable_catalog_item_id")
    .eq("pass_catalog_item_id", passCatalogItemId);

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
        reservableCatalogItemIds.map((id) => ({
          site_id: siteId,
          pass_catalog_item_id: passCatalogItemId,
          reservable_catalog_item_id: id,
        }))
      );
    if (insError) throw new Error(insError.message);
  }

  return { success: true };
}
