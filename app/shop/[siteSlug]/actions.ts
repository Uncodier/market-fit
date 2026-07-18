import { getSiteInfoBySlug } from "@/app/book/actions";
import { createServiceClient } from "@/lib/supabase/server";

export async function getShopSite(slug: string) {
  // Try to find the site ID by slug
  const site = await getSiteInfoBySlug(slug);
  return site;
}

export async function getShopCatalog(siteId: string) {
  const supabase = await createServiceClient(true);
  
  // Get active items
  const { data: items, error } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "active")
    .order("name");
    
  if (error || !items) return { data: [], error: error?.message };
  
  // Get default price list
  const { data: defaultList } = await supabase
    .from("price_lists")
    .select("id")
    .eq("site_id", siteId)
    .eq("is_default", true)
    .single();
    
  if (defaultList) {
    const { data: prices } = await supabase
      .from("price_list_items")
      .select("catalog_item_id, unit_price")
      .eq("price_list_id", defaultList.id);
      
    if (prices && prices.length > 0) {
      const priceMap = new Map(prices.map(p => [p.catalog_item_id, p.unit_price]));
      const itemsWithPrice = items.map(item => ({
        ...item,
        target_sale_price: priceMap.get(item.id) ?? item.target_sale_price
      }));
      return { data: itemsWithPrice };
    }
  }
    
  return { data: items };
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
