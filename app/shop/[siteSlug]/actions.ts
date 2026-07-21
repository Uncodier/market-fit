import { getSiteInfoBySlug } from "@/app/book/actions";
import { createServiceClient } from "@/lib/supabase/server";

export async function getShopSite(slug: string) {
  // Try to find the site ID by slug
  const site = await getSiteInfoBySlug(slug);
  return site;
}

export async function getShopCatalog(siteId: string) {
  const supabase = await createServiceClient(true);
  
  // 1. Get active items with their categories
  const { data: items, error } = await supabase
    .from("catalog_items")
    .select(`
      *,
      category:catalog_categories(name)
    `)
    .eq("site_id", siteId)
    .eq("status", "active")
    .order("name");
    
  if (error || !items) return { data: [], error: error?.message };
  
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
      target_sale_price: finalPrice,
      _shop: {
        categoryName: item.category?.[0]?.name || null,
        sellable,
        availableQty
      }
    };
  });
    
  return { data: enrichedItems };
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
