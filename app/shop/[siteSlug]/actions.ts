"use server"

import { getSiteInfoBySlug } from "@/app/book/actions";
import { createServiceClient } from "@/lib/supabase/server";

export async function getShopSite(slug: string) {
  // Try to find the site ID by slug
  const site = await getSiteInfoBySlug(slug);
  return site;
}

export async function getShopCategories(siteId: string) {
  const supabase = await createServiceClient(true);

  // Only return categories that currently have at least one shop-visible product.
  const { data, error } = await supabase
    .from("catalog_categories")
    .select(`
      name,
      sort_order,
      catalog_items!inner (
        id
      )
    `)
    .eq("site_id", siteId)
    .eq("catalog_items.status", "active")
    .eq("catalog_items.is_marketplace_listed", true)
    .is("catalog_items.parent_id", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!error && data) {
    const cats: string[] = [];
    for (const row of data as Array<{ name?: string | null }>) {
      if (row.name && !cats.includes(row.name)) {
        cats.push(row.name);
      }
    }
    return cats;
  }

  // Fallback: derive non-empty categories from listed catalog items
  const { data: items } = await supabase
    .from("catalog_items")
    .select("category:catalog_categories(name, sort_order)")
    .eq("site_id", siteId)
    .eq("status", "active")
    .eq("is_marketplace_listed", true)
    .is("parent_id", null)
    .not("category_id", "is", null);

  if (!items) return [];

  // Group to preserve sort_order from category
  const catSet = new Map<string, number>();
  for (const item of items as any[]) {
    const cat = Array.isArray(item.category)
      ? item.category[0]
      : item.category;
    if (cat?.name) {
      catSet.set(cat.name, cat.sort_order ?? 99999);
    }
  }
  
  return Array.from(catSet.entries())
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(e => e[0]);
}

export async function getShopCatalog(
  siteId: string, 
  options: { page?: number, pageSize?: number, search?: string, category?: string } = {}
) {
  const { page = 1, pageSize = 20, search = '', category = 'all' } = options;
  const supabase = await createServiceClient(true);
  
  // 1. Get active items with their categories (only parents or items without variants)
  let query = supabase
    .from("catalog_items")
    .select(`
      *,
      category:catalog_categories(name),
      raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
    `, { count: 'exact' })
    .eq("site_id", siteId)
    .eq("status", "active")
    .eq("is_marketplace_listed", true)
    .is("parent_id", null);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  // Category is applied after fetch enrichment when filtering by name on the join
  // is unreliable; for category filter we resolve matching category IDs first.
  if (category !== 'all') {
    const { data: cats } = await supabase
      .from("catalog_categories")
      .select("id")
      .eq("site_id", siteId)
      .eq("name", category);
    const catIds = (cats || []).map((c) => c.id);
    if (catIds.length === 0) {
      return { data: [], count: 0, totalPages: 0, page, pageSize };
    }
    query = query.in("category_id", catIds);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to).order("sort_order", { ascending: true }).order("name", { ascending: true });

  const { data: items, count, error } = await query;
    
  if (error || !items) return { data: [], count: 0, totalPages: 0, page, pageSize, error: error?.message };
  
  // 2. Get default price list to override target_sale_price
  const { data: defaultList } = await supabase
    .from("price_lists")
    .select("id")
    .eq("site_id", siteId)
    .eq("is_default", true)
    .single();
    
  let priceMap = new Map();
  if (defaultList) {
    const { data: prices } = await supabase
      .from("price_list_items")
      .select("catalog_item_id, unit_price")
      .eq("price_list_id", defaultList.id);
      
    if (prices && prices.length > 0) {
      priceMap = new Map(prices.map(p => [p.catalog_item_id, p.unit_price]));
    }
  }

  // 3. Get inventory levels and commerce settings for availability check
  const [levelsRes, settingsRes] = await Promise.all([
    supabase
      .from("inventory_levels")
      .select("catalog_item_id, quantity")
      .eq("site_id", siteId),
    supabase
      .from("settings")
      .select("commerce")
      .eq("site_id", siteId)
      .single()
  ]);

  const inventoryMap = new Map<string, number>();
  if (levelsRes.data) {
    for (const level of levelsRes.data) {
      const current = inventoryMap.get(level.catalog_item_id) || 0;
      inventoryMap.set(level.catalog_item_id, current + Number(level.quantity));
    }
  }

  const commerceSettings = settingsRes.data?.commerce as any || { stock_shortage_policy: 'allow' };
  const policy = commerceSettings.stock_shortage_policy || 'allow';

  // 4. Transform and enrich items
  const enrichedItems = items.map(item => {
    // Determine price
    const finalPrice = priceMap.get(item.id) ?? item.target_sale_price;

    // Determine availability
    let sellable = true;
    let availableQty: number | undefined = undefined;

    if (item.availability_mode === 'manual') {
      sellable = item.availability_status === 'available';
    } else if (item.availability_mode === 'inventory') {
      availableQty = inventoryMap.get(item.id) || 0;
      sellable = availableQty > 0 || policy !== 'block';
    }

    return {
      ...item,
      item_specs: ((item as any).raw_specs || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((cis: any) => cis.item_spec).filter(Boolean),
      target_sale_price: finalPrice,
      _shop: {
        categoryName: (Array.isArray(item.category) ? item.category[0]?.name : item.category?.name) || null,
        sellable,
        availableQty
      }
    };
  });
    
  return { 
    data: enrichedItems, 
    count: count || 0,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
    page,
    pageSize
  };
}

export async function getShopItemsByIds(siteId: string, ids: string[]) {
  if (!ids || ids.length === 0) return { data: [] };
  const supabase = await createServiceClient(true);

  const { data: items, error } = await supabase
    .from("catalog_items")
    .select(`
      *,
      category:catalog_categories(name),
      raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
    `)
    .eq("site_id", siteId)
    .in("id", ids);

  if (error || !items) return { data: [], error: error?.message };

  const [levelsRes, settingsRes, defaultList] = await Promise.all([
    supabase.from("inventory_levels").select("catalog_item_id, quantity").eq("site_id", siteId),
    supabase.from("settings").select("commerce").eq("site_id", siteId).single(),
    supabase.from("price_lists").select("id").eq("site_id", siteId).eq("is_default", true).maybeSingle(),
  ]);

  let priceMap = new Map();
  if (defaultList.data) {
    const { data: prices } = await supabase
      .from("price_list_items")
      .select("catalog_item_id, unit_price")
      .eq("price_list_id", defaultList.data.id);
    if (prices?.length) priceMap = new Map(prices.map((p) => [p.catalog_item_id, p.unit_price]));
  }

  const inventoryMap = new Map<string, number>();
  for (const level of levelsRes.data || []) {
    inventoryMap.set(level.catalog_item_id, (inventoryMap.get(level.catalog_item_id) || 0) + Number(level.quantity));
  }
  const policy = (settingsRes.data?.commerce as any)?.stock_shortage_policy || "allow";

  const byId = new Map(
    items.map((item) => {
      let sellable = true;
      let availableQty: number | undefined;
      if (item.availability_mode === "manual") {
        sellable = item.availability_status === "available";
      } else if (item.availability_mode === "inventory") {
        availableQty = inventoryMap.get(item.id) || 0;
        sellable = availableQty > 0 || policy !== "block";
      }
      return [
        item.id,
        {
          ...item,
          item_specs: ((item as any).raw_specs || [])
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((cis: any) => cis.item_spec)
            .filter(Boolean),
          target_sale_price: priceMap.get(item.id) ?? item.target_sale_price,
          _shop: {
            categoryName: (Array.isArray(item.category) ? item.category[0]?.name : item.category?.name) || null,
            sellable,
            availableQty,
          },
        },
      ];
    })
  );

  return { data: ids.map((id) => byId.get(id)).filter(Boolean) };
}

export type ShopOwnedAccess = {
  catalogItemId: string;
  canBook: boolean;
};

export async function getShopUserOwnedItems(siteId: string): Promise<ShopOwnedAccess[]> {
  const { createClient } = await import("@/lib/supabase/server");
  // Always skip demo: shop is a real commerce surface and the demo mock
  // client breaks / loops when mixed with live site IDs.
  const supabase = await createClient(true);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();
  
  // 1. Get active entitlements (excluding those granted by subscriptions since the subscription itself is shown)
  const { data: entitlements } = await supabase
    .from('entitlements')
    .select('catalog_item_id')
    .eq('site_id', siteId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active')
    .neq('source_type', 'subscription')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`uses_remaining.is.null,uses_remaining.gt.0`);
    
  // 2. Get active subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('catalog_item_id')
    .eq('site_id', siteId)
    .eq('buyer_user_id', user.id)
    .eq('status', 'active');
    
  const ownedIds = new Set<string>();
  entitlements?.forEach((e: any) => ownedIds.add(e.catalog_item_id!));
  subscriptions?.forEach((s: any) => ownedIds.add(s.catalog_item_id!));
  
  const ownedArray = Array.from(ownedIds);
  if (ownedArray.length === 0) return [];

  // Direct: owned catalog items that are themselves reservable (plan-as-calendar / owned service)
  const { data: ownedCatalog } = await supabase
    .from('catalog_items')
    .select('id, is_reservation')
    .in('id', ownedArray);

  const reservableOwned = new Set(
    (ownedCatalog || []).filter((c: any) => c.is_reservation).map((c: any) => c.id)
  );

  // Plans → passes they grant (pass may or may not already be in ownedArray)
  const { data: planItems } = await supabase
    .from('subscription_plan_items')
    .select('plan_catalog_item_id, digital_catalog_item_id')
    .in('plan_catalog_item_id', ownedArray);

  const planPassIds = (planItems || [])
    .map((pi: any) => pi.digital_catalog_item_id)
    .filter(Boolean);

  const passIdsToCheck = Array.from(new Set([...ownedArray, ...planPassIds]));

  // Indirect: passes with at least one redeemable (calendar on plan or another service)
  const { data: passRedeemables } = await supabase
    .from('pass_redeemable_items')
    .select('pass_catalog_item_id')
    .in('pass_catalog_item_id', passIdsToCheck);

  const passesWithRedeemables = new Set(
    (passRedeemables || []).map((r: any) => r.pass_catalog_item_id)
  );

  const plansWithBookablePasses = new Set<string>();
  (planItems || []).forEach((pi: any) => {
    if (passesWithRedeemables.has(pi.digital_catalog_item_id)) {
      plansWithBookablePasses.add(pi.plan_catalog_item_id);
    }
  });

  return ownedArray.map(id => ({
    catalogItemId: id,
    canBook:
      reservableOwned.has(id) ||
      passesWithRedeemables.has(id) ||
      plansWithBookablePasses.has(id),
  }));
}

export async function getShopLocations(siteId: string) {
  const supabase = await createServiceClient(true);
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("site_id", siteId)
    .order("name");
    
  return { data: data || [] };
}
