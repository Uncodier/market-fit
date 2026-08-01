"use server";

import { createClient } from "@/lib/supabase/server";
import { assertReservationSlot } from "@/app/reservations/availability";

export interface BookWithEntitlementParams {
  entitlementId: string;
  reservableCatalogItemId: string;
  startIso: string;
  endIso: string;
  quantity: number;
}

export async function bookWithEntitlement({
  entitlementId,
  reservableCatalogItemId,
  startIso,
  endIso,
  quantity
}: BookWithEntitlementParams) {
  const supabase = await createClient();

  // 1. Load active entitlement
  const { data: entitlement, error: entError } = await supabase
    .from("entitlements")
    .select("*, catalog_item:catalog_items(id, kind, digital_subtype)")
    .eq("id", entitlementId)
    .single();

  if (entError || !entitlement) {
    throw new Error("Entitlement not found.");
  }

  if (entitlement.status !== "active") {
    throw new Error(`Cannot book using a ${entitlement.status} entitlement.`);
  }

  if (entitlement.expires_at && new Date(entitlement.expires_at) < new Date()) {
    throw new Error("This pass has expired.");
  }

  if (entitlement.uses_remaining !== null && entitlement.uses_remaining < quantity) {
    throw new Error(`Not enough uses remaining on this pass (has ${entitlement.uses_remaining}, requested ${quantity}).`);
  }

  // 2. Validate reservable item
  // Subscriptions vs Passes:
  // If it's a pass entitlement (kind=digital_asset, subtype=pass), check pass_redeemable_items
  if (entitlement.catalog_item?.kind === "digital_asset" && entitlement.catalog_item?.digital_subtype === "pass") {
    const { data: redeemable } = await supabase
      .from("pass_redeemable_items")
      .select("id")
      .eq("pass_catalog_item_id", entitlement.catalog_item_id)
      .eq("reservable_catalog_item_id", reservableCatalogItemId)
      .single();

    if (!redeemable) {
      throw new Error("This pass cannot be used for this service.");
    }
  } else {
    // Other entitlement types might not be passes...
    throw new Error("Entitlement is not a valid pass for reservations.");
  }

  // 3. Assert Slot
  await assertReservationSlot(
    entitlement.site_id,
    reservableCatalogItemId,
    startIso,
    endIso,
    quantity,
    true // Treat as admin/system so it bypasses some frontend checks if needed, but the actual rules are checked.
  );

  // Get lead for buyer
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("buyer_user_id", entitlement.buyer_user_id)
    .eq("site_id", entitlement.site_id)
    .single();

  let finalLeadId = lead?.id;
  if (!finalLeadId) {
    // Try to get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", entitlement.buyer_user_id)
      .single();
      
    if (profile) {
      const { data: newLead } = await supabase
        .from("leads")
        .insert({
          site_id: entitlement.site_id,
          buyer_user_id: entitlement.buyer_user_id,
          name: `${profile.first_name} ${profile.last_name}`.trim() || 'Unknown',
          email: profile.email,
          status: "new"
        })
        .select("id")
        .single();
      if (newLead) finalLeadId = newLead.id;
    }
  }

  if (!finalLeadId) {
    throw new Error("Could not resolve customer record for this booking.");
  }

  // 4. Insert Reservation
  const { data: reservation, error: resError } = await supabase
    .from("reservations")
    .insert({
      site_id: entitlement.site_id,
      catalog_item_id: reservableCatalogItemId,
      lead_id: finalLeadId,
      buyer_user_id: entitlement.buyer_user_id,
      owner_site_id: entitlement.owner_site_id,
      status: "confirmed",
      start_time: startIso,
      end_time: endIso,
      quantity,
      entitlement_id: entitlement.id,
    })
    .select()
    .single();

  if (resError) throw new Error(resError.message);

  // 5. Decrement Uses
  if (entitlement.uses_remaining !== null) {
    const newUses = entitlement.uses_remaining - quantity;
    const { error: updError } = await supabase
      .from("entitlements")
      .update({
        uses_remaining: newUses,
        status: newUses <= 0 ? "used" : "active"
      })
      .eq("id", entitlement.id);

    if (updError) throw new Error(updError.message);
  }

  return reservation;
}
