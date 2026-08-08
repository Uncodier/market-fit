"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Location, InventoryLevel } from "@/app/types";
import { InventoryLevelWithCatalog, InventoryParams } from "./types";

export async function findOrCreateLocation(siteId: string, name: string) {
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("locations")
      .select("*")
      .eq("site_id", siteId)
      .ilike("name", name)
      .limit(1)
      .single();

    if (existing) {
      return { location: existing as Location };
    }

    const { data: newLocation, error: createError } = await supabase
      .from("locations")
      .insert({ site_id: siteId, name, is_default: false, is_active: true })
      .select()
      .single();

    if (createError) throw new Error(createError.message);
    revalidatePath(`/inventory`);
    return { location: newLocation as Location };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Locations
export async function listLocations(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("site_id", siteId)
      .order("name");

    if (error) throw new Error(error.message);
    return { data: data as Location[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

/** Public storefront read — bypasses member-only RLS on locations. */
export async function listPublicLocations(siteId: string) {
  try {
    const supabase = await createServiceClient(true);
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("site_id", siteId)
      .order("name");

    if (error) throw new Error(error.message);
    return { data: (data || []) as Location[] };
  } catch (error: any) {
    return { data: [] as Location[], error: error.message };
  }
}

export async function upsertLocation(location: Partial<Location>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .upsert({ ...location, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/inventory`);
    return { data: data as Location };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteLocation(locationId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", locationId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);
    revalidatePath(`/inventory`);
    revalidatePath(`/settings`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Inventory Levels
export async function listInventoryLevels({ siteId, locationId, q, page = 1, pageSize = 50 }: InventoryParams) {
  try {
    const supabase = await createClient();
    
    // Using inner join on catalog_items to allow filtering
    let query = supabase
      .from("inventory_levels")
      .select(`
        *,
        catalog_items!inner(*)
      `, { count: "exact" })
      .eq("site_id", siteId);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }
    
    if (q) {
      query = query.ilike("catalog_items.name", `%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    // Flatten structure for nested array if needed
    const formattedData = data.map((d: any) => ({
      ...d,
      catalog_item: Array.isArray(d.catalog_items) ? d.catalog_items[0] : d.catalog_items
    }));

    return { data: formattedData as InventoryLevelWithCatalog[], count: count || 0 };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function setInventoryLevel(siteId: string, locationId: string, catalogItemId: string, quantity: number) {
  try {
    const supabase = await createClient();
    
    const { data: existing } = await supabase
      .from("inventory_levels")
      .select("id")
      .eq("location_id", locationId)
      .eq("catalog_item_id", catalogItemId)
      .single();

    let res;
    if (existing) {
      res = await supabase
        .from("inventory_levels")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from("inventory_levels")
        .insert({
          site_id: siteId,
          location_id: locationId,
          catalog_item_id: catalogItemId,
          quantity
        })
        .select()
        .single();
    }

    if (res.error) throw new Error(res.error.message);
    revalidatePath(`/inventory`);
    return { data: res.data as InventoryLevel };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function transferInventory(siteId: string, catalogItemId: string, fromLocationId: string, toLocationId: string, quantity: number) {
  try {
    const supabase = await createClient();
    
    // Get source quantity
    const { data: source } = await supabase
      .from("inventory_levels")
      .select("id, quantity")
      .eq("location_id", fromLocationId)
      .eq("catalog_item_id", catalogItemId)
      .single();
      
    if (!source || source.quantity < quantity) {
      throw new Error("Insufficient stock at source location");
    }

    // Call RPC or perform in sequence if no RPC is defined
    // Doing in sequence for simplicity, ideally needs a transaction in RPC
    await supabase.from("inventory_levels").update({ quantity: source.quantity - quantity }).eq("id", source.id);
    
    // Let's rewrite set logic for target to add
    const { data: target } = await supabase
      .from("inventory_levels")
      .select("id, quantity")
      .eq("location_id", toLocationId)
      .eq("catalog_item_id", catalogItemId)
      .single();
      
    if (target) {
      await supabase.from("inventory_levels").update({ quantity: target.quantity + quantity }).eq("id", target.id);
    } else {
      await supabase.from("inventory_levels").insert({
        site_id: siteId,
        location_id: toLocationId,
        catalog_item_id: catalogItemId,
        quantity: quantity
      });
    }

    revalidatePath(`/inventory`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Commerce Settings
export async function getCommerceSettings(siteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("commerce").eq("site_id", siteId).single();
  if (error) return { error: error.message };
  return { data: data.commerce || {} };
}

export async function updateCommerceSettings(siteId: string, settings: any) {
  const supabase = await createClient();
  const { data: current } = await supabase.from("settings").select("commerce").eq("site_id", siteId).single();
  
  const merged = { ...(current?.commerce || {} as any), ...settings };
  
  const { error } = await supabase.from("settings").update({ commerce: merged }).eq("site_id", siteId);
  if (error) return { error: error.message };
  
  revalidatePath(`/inventory`);
  return { success: true };
}
