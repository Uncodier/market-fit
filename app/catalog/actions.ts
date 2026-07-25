"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CatalogItem } from "@/app/types";
import { CatalogListParams, CatalogListResponse, CatalogAvailabilityResult } from "./types";

export async function listCatalogCategories(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_categories")
      .select("*")
      .eq("site_id", siteId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return { data: [], error: error.message };
    }
    
    return { data };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function upsertCatalogCategory(category: { id?: string, site_id: string, name: string, description?: string }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_categories")
      .upsert({
        ...category,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listCatalogItems({
  siteId,
  kind = 'all',
  q = '',
  status = 'active',
  availabilityStatus = 'all',
  page = 1,
  pageSize = 50,
  isPosAvailable,
  isRecurring,
  isReservation
}: CatalogListParams): Promise<CatalogListResponse> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("catalog_items")
      .select("*", { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (kind !== 'all') {
      query = query.eq('kind', kind);
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (availabilityStatus !== 'all') {
      query = query.eq('availability_status', availabilityStatus);
    }
    if (isPosAvailable !== undefined) {
      query = query.eq('is_pos_available', isPosAvailable);
    }
    if (isRecurring !== undefined) {
      query = query.eq('is_recurring', isRecurring);
    }
    if (isReservation !== undefined) {
      query = query.eq('is_reservation', isReservation);
    }
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching catalog items:", error);
      return { data: [], count: 0, error: error.message };
    }

    return { 
      data: data as CatalogItem[], 
      count: count || 0 
    };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function getCatalogItem(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as CatalogItem };
}

export async function upsertCatalogItem(item: Partial<CatalogItem>) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("catalog_items")
      .upsert({
        ...item,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    if (item.site_id) {
      revalidatePath(`/shop/${item.site_id}`);
    }
    
    return { data: data as CatalogItem };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateCatalogAvailability(
  siteId: string, 
  catalogItemId: string, 
  updates: {
    availability_status?: 'available' | 'unavailable' | 'sold_out';
    availability_mode?: 'manual' | 'inventory' | 'always';
    track_inventory?: boolean;
  }
) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("catalog_items")
      .update(updates)
      .eq("id", catalogItemId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    
    return { data: data as CatalogItem };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteCatalogItem(siteId: string, catalogItemId: string) {
  try {
    const supabase = await createClient();
    
    // Soft delete by archiving
    const { error } = await supabase
      .from("catalog_items")
      .update({ status: 'archived' })
      .eq("id", catalogItemId)
      .eq("site_id", siteId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Checks if an item can be sold based on availability mode and inventory levels.
 */
export async function getCatalogAvailability(
  siteId: string,
  catalogItemId: string,
  quantity: number = 1,
  locationId?: string,
  forceServiceRole: boolean = false
): Promise<CatalogAvailabilityResult> {
  const supabase = forceServiceRole ? await createServiceClient(true) : await createClient();

  // 1. Fetch item & site policy
  const [itemRes, settingsRes] = await Promise.all([
    supabase.from("catalog_items").select("*").eq("id", catalogItemId).eq("site_id", siteId).single(),
    supabase.from("settings").select("commerce").eq("site_id", siteId).single()
  ]);

  if (itemRes.error) return { sellable: false, reason: "Item not found", policy: 'block' };
  
  const item = itemRes.data;
  const commerceSettings = settingsRes.data?.commerce as any || { stock_shortage_policy: 'allow' };
  const policy = commerceSettings.stock_shortage_policy || 'allow';

  // 1. Check status
  if (item.status !== 'active') {
    return { sellable: false, reason: "Item is archived", policy };
  }

  // 2. Check mode
  if (item.availability_mode === 'always') {
    return { sellable: true, policy };
  }

  if (item.availability_mode === 'manual') {
    if (item.availability_status === 'available') {
      return { sellable: true, policy };
    } else {
      return { sellable: false, reason: `Item is marked as ${item.availability_status}`, policy };
    }
  }

  // 3. Inventory mode
  if (item.availability_mode === 'inventory') {
    let query = supabase
      .from("inventory_levels")
      .select("quantity")
      .eq("catalog_item_id", catalogItemId)
      .eq("site_id", siteId);
      
    if (locationId) {
      query = query.eq("location_id", locationId);
    }
    
    const { data: levels } = await query;
    
    const availableQty = levels?.reduce((sum: number, level: any) => sum + Number(level.quantity), 0) || 0;
    
    if (quantity <= availableQty) {
      return { sellable: true, availableQty, policy };
    } else {
      return { 
        sellable: policy !== 'block', 
        reason: `Insufficient stock (requested ${quantity}, available ${availableQty})`,
        availableQty,
        policy
      };
    }
  }

  return { sellable: true, policy };
}

export async function assertCanSell(siteId: string, catalogItemId: string, quantity: number = 1, locationId?: string, forceServiceRole: boolean = false) {
  const result = await getCatalogAvailability(siteId, catalogItemId, quantity, locationId, forceServiceRole);
  if (!result.sellable) {
    throw new Error(result.reason || "Item cannot be sold");
  }
  return result;
}

export async function getSubscriptionPlanItems(planCatalogItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subscription_plan_items')
    .select('*, digital_catalog_item:catalog_items!digital_catalog_item_id(id, name, kind, digital_subtype)')
    .eq('plan_catalog_item_id', planCatalogItemId)
  return { data, error: error?.message }
}

export async function addSubscriptionPlanItem(siteId: string, planCatalogItemId: string, digitalCatalogItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subscription_plan_items')
    .insert({ site_id: siteId, plan_catalog_item_id: planCatalogItemId, digital_catalog_item_id: digitalCatalogItemId })
    .select()
    .single()
  return { data, error: error?.message }
}

export async function removeSubscriptionPlanItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('subscription_plan_items')
    .delete()
    .eq('id', id)
  return { error: error?.message }
}

export async function findOrCreateCatalogCategory(site_id: string, name: string) {
  try {
    if (!name || !name.trim()) return { category: null, error: "Name is required" }
    const trimmed = name.trim()

    const supabase = await createClient()
    const { data: existing, error: searchError } = await supabase
      .from("catalog_categories")
      .select("*")
      .eq("site_id", site_id)
      .ilike("name", trimmed)
      .limit(1)
      .single()

    if (existing) return { category: existing, error: null }
    if (searchError && searchError.code !== "PGRST116") {
      return { category: null, error: searchError.message }
    }

    const { data: category, error } = await supabase
      .from("catalog_categories")
      .insert({
        site_id,
        name: trimmed
      })
      .select()
      .single()

    return { category, error: error?.message || null }
  } catch (error: any) {
    return { category: null, error: error.message }
  }
}

export async function findOrCreateCatalogItem(site_id: string, name: string, defaults?: Record<string, any>) {
  try {
    if (!name || !name.trim()) return { item: null, error: "Name is required" }
    const trimmed = name.trim()

    const supabase = await createClient()
    const { data: existing, error: searchError } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("site_id", site_id)
      .ilike("name", trimmed)
      .limit(1)
      .single()

    if (existing) return { item: existing, error: null }
    if (searchError && searchError.code !== "PGRST116") {
      return { item: null, error: searchError.message }
    }

    const kind = defaults?.kind || "product"

    const { data: item, error } = await supabase
      .from("catalog_items")
      .insert({
        site_id,
        name: trimmed,
        kind,
        status: "active",
        ...defaults
      })
      .select()
      .single()

    return { item, error: error?.message || null }
  } catch (error: any) {
    return { item: null, error: error.message }
  }
}

