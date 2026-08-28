"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CatalogItem } from "@/app/types";
import { CatalogListParams, CatalogListResponse } from "./types";
import { attachCatalogRelationSummaries } from "./relation-summaries";
import { shopCacheTag } from "@/app/shop/[siteSlug]/shop-catalog-shared";

export async function listCatalogCategories(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_categories")
      .select("*")
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true })
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

export async function upsertCatalogCategory(category: { id?: string, site_id: string, name: string, description?: string, income_account_key?: string | null, cogs_account_key?: string | null }) {
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
      .select("*, parent:parent_id(name)", { count: "exact" })
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (kind === 'variant') {
      query = query.not('parent_id', 'is', null);
    } else if (kind !== 'all') {
      query = query.eq('kind', kind).is('parent_id', null);
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

    const withRelations = await attachCatalogRelationSummaries(
      (data || []) as CatalogItem[]
    );

    return {
      data: withRelations,
      count: count || 0,
    };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function getCatalogItem(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*, parent:parent_id(name), raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))")
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  if (data?.parent?.name) {
    data._parent = { name: data.parent.name, id: data.parent_id };
  }

  if (data?.raw_specs) {
    data.item_specs = (data.raw_specs as any[])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((cis) => cis.item_spec)
      .filter(Boolean);
    delete data.raw_specs;
  }

  return { data: data as CatalogItem };
}

async function ensurePassRedeemsCatalogItem(
  siteId: string,
  passCatalogItemId: string,
  reservableCatalogItemId: string
) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('pass_redeemable_items')
    .select('id')
    .eq('pass_catalog_item_id', passCatalogItemId)
    .eq('reservable_catalog_item_id', reservableCatalogItemId)
    .maybeSingle()

  if (existing) return

  await supabase.from('pass_redeemable_items').insert({
    site_id: siteId,
    pass_catalog_item_id: passCatalogItemId,
    reservable_catalog_item_id: reservableCatalogItemId,
    sort_order: 0,
  })
}

async function cascadeToVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  parentId: string,
  updates: { status?: "archived"; availability_mode?: "manual"; availability_status?: "unavailable" }
) {
  await supabase
    .from("catalog_items")
    .update(updates)
    .eq("parent_id", parentId)
    .eq("site_id", siteId)
}

export async function upsertCatalogItem(item: Partial<CatalogItem>) {
  try {
    const supabase = await createClient();
    
    const { item_specs, raw_specs, parent, _parent, plan_includes, pass_redeems, ...dbItem } = item as any;

    let data, error;
    
    if (dbItem.id) {
      const { data: updateData, error: updateError } = await supabase
        .from("catalog_items")
        .update({
          ...dbItem,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dbItem.id)
        .select()
        .single();
      
      data = updateData;
      error = updateError;
    } else {
      const { data: insertData, error: insertError } = await supabase
        .from("catalog_items")
        .insert({
          ...dbItem,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
        
      data = insertData;
      error = insertError;
    }

    if (error) {
      return { error: error.message };
    }

    // Plan-as-calendar: when a recurring plan becomes reservable, link existing passes to it
    if (data?.id && data.site_id && data.is_recurring && data.is_reservation) {
      const { data: planItems } = await supabase
        .from('subscription_plan_items')
        .select('digital_catalog_item_id, digital_catalog_item:catalog_items!digital_catalog_item_id(digital_subtype)')
        .eq('plan_catalog_item_id', data.id)

      for (const pi of planItems || []) {
        const subtype = (pi as any).digital_catalog_item?.digital_subtype
        if (subtype === 'pass' && pi.digital_catalog_item_id) {
          await ensurePassRedeemsCatalogItem(data.site_id, pi.digital_catalog_item_id, data.id)
        }
      }
    }

    if (data?.id && data.site_id) {
      if (data.status === 'archived') {
        await cascadeToVariants(supabase, data.site_id, data.id, { status: 'archived' });
      }

      if (data.availability_mode === 'manual' && data.availability_status === 'unavailable') {
        await cascadeToVariants(supabase, data.site_id, data.id, {
          availability_mode: 'manual',
          availability_status: 'unavailable',
        });
      }
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    if (item.site_id) {
      revalidatePath(`/shop/${item.site_id}`);
      revalidateTag(shopCacheTag(item.site_id), "max");
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

    if (updates.availability_status === 'unavailable') {
      await cascadeToVariants(supabase, siteId, catalogItemId, {
        availability_mode: 'manual',
        availability_status: 'unavailable',
      });
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    revalidateTag(shopCacheTag(siteId), "max");
    
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

    // Clean up pass_redeemable_items for this item and its variants
    const { data: children } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("parent_id", catalogItemId)
      .eq("site_id", siteId);

    const idsToRemove = [catalogItemId, ...(children?.map((c: any) => c.id) || [])];

    await supabase
      .from("pass_redeemable_items")
      .delete()
      .in("reservable_catalog_item_id", idsToRemove);

    // Archive all variants
    await cascadeToVariants(supabase, siteId, catalogItemId, { status: 'archived' });

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    revalidateTag(shopCacheTag(siteId), "max");
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function unarchiveCatalogItem(siteId: string, catalogItemId: string) {
  try {
    const supabase = await createClient();
    
    // Restore by setting status to active
    const { error } = await supabase
      .from("catalog_items")
      .update({ status: 'active' })
      .eq("id", catalogItemId)
      .eq("site_id", siteId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/pos`);
    revalidateTag(shopCacheTag(siteId), "max");
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
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
    
  if (!error) {
    // Auto-link: if plan is reservable, make the pass redeemable against the plan itself
    const { data: plan } = await supabase
      .from('catalog_items')
      .select('is_reservation')
      .eq('id', planCatalogItemId)
      .single()
      
    if (plan?.is_reservation) {
      await ensurePassRedeemsCatalogItem(siteId, digitalCatalogItemId, planCatalogItemId)
    }
  }

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
        is_purchasable: true,
        ...defaults
      })
      .select()
      .single()

    return { item, error: error?.message || null }
  } catch (error: any) {
    return { item: null, error: error.message }
  }
}

