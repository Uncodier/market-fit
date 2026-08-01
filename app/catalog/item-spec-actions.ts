"use server";

import { createClient } from "@/lib/supabase/server";
import { ItemSpecCategory, ItemSpec, CatalogItemSpec } from "@/app/types";

const SYSTEM_CATEGORIES = [
  { slug: 'venue', name: 'Venue' },
  { slug: 'instructor', name: 'Instructor' },
  { slug: 'brand', name: 'Brand' },
  { slug: 'artist', name: 'Artist' },
  { slug: 'event', name: 'Event' },
  { slug: 'organizer', name: 'Organizer' },
  { slug: 'host', name: 'Host' },
  { slug: 'author', name: 'Author' },
  { slug: 'publisher', name: 'Publisher' },
  { slug: 'collection', name: 'Collection' },
];

export async function ensureDefaultItemSpecCategories(siteId: string) {
  try {
    const supabase = await createClient();
    
    // Check existing system categories for this site
    const { data: existing } = await supabase
      .from("item_spec_categories")
      .select("slug")
      .eq("site_id", siteId)
      .eq("is_system", true);
      
    const existingSlugs = new Set(existing?.map(c => c.slug) || []);
    const missing = SYSTEM_CATEGORIES.filter(c => !existingSlugs.has(c.slug));
    
    if (missing.length > 0) {
      const inserts = missing.map(c => ({
        site_id: siteId,
        slug: c.slug,
        name: c.name,
        is_system: true,
      }));
      
      const { error } = await supabase
        .from("item_spec_categories")
        .insert(inserts)
        .select();
        
      if (error) {
        console.error("Error ensuring default item spec categories:", error);
      }
    }
  } catch (error) {
    console.error("Error ensuring default item spec categories:", error);
  }
}

export async function listItemSpecCategories(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("item_spec_categories")
      .select("*")
      .eq("site_id", siteId)
      .order("name", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: data as ItemSpecCategory[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function createItemSpecCategory(siteId: string, name: string) {
  try {
    const supabase = await createClient();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    const { data, error } = await supabase
      .from("item_spec_categories")
      .insert({
        site_id: siteId,
        name,
        slug,
        is_system: false
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { data: data as ItemSpecCategory };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listItemSpecs(siteId: string, categoryId?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("item_specs")
      .select("*, category:item_spec_categories(*)")
      .eq("site_id", siteId)
      .order("name", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data as ItemSpec[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function upsertItemSpec(spec: Partial<ItemSpec> & { site_id: string, category_id: string, name: string }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("item_specs")
      .upsert({
        ...spec,
        updated_at: new Date().toISOString()
      })
      .select("*, category:item_spec_categories(*)")
      .single();

    if (error) return { error: error.message };
    return { data: data as ItemSpec };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function findOrCreateItemSpec(siteId: string, categoryId: string, name: string) {
  try {
    const supabase = await createClient();
    const { data: existing, error: searchError } = await supabase
      .from("item_specs")
      .select("*, category:item_spec_categories(*)")
      .eq("site_id", siteId)
      .eq("category_id", categoryId)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (searchError) return { error: searchError.message };
    if (existing) return { data: existing as ItemSpec };

    const { data: created, error: createError } = await supabase
      .from("item_specs")
      .insert({
        site_id: siteId,
        category_id: categoryId,
        name: name
      })
      .select("*, category:item_spec_categories(*)")
      .single();

    if (createError) return { error: createError.message };
    return { data: created as ItemSpec };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listCatalogItemSpecs(catalogItemId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_item_specs")
      .select("*, item_spec:item_specs(*, category:item_spec_categories(*))")
      .eq("catalog_item_id", catalogItemId)
      .order("sort_order", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: data as CatalogItemSpec[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function setCatalogItemSpecs(catalogItemId: string, itemSpecIds: string[]) {
  try {
    const supabase = await createClient();
    
    // First delete all existing links
    const { error: deleteError } = await supabase
      .from("catalog_item_specs")
      .delete()
      .eq("catalog_item_id", catalogItemId);
      
    if (deleteError) return { error: deleteError.message };
    
    if (itemSpecIds.length > 0) {
      const inserts = itemSpecIds.map((id, index) => ({
        catalog_item_id: catalogItemId,
        item_spec_id: id,
        sort_order: index
      }));
      
      const { error: insertError } = await supabase
        .from("catalog_item_specs")
        .insert(inserts);
        
      if (insertError) return { error: insertError.message };
    }
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
