import { createServiceClient } from "@/lib/supabase/server";
import { CatalogItem } from "@/app/types";
import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details";

export async function getPdpCatalogItem(itemId: string, options?: { siteId?: string, requireMarketplace?: boolean }) {
  const supabase = await createServiceClient(true);
  
  let query = supabase
    .from("catalog_items")
    .select(`
      *,
      site:sites(id, name, logo_url),
      category:catalog_categories(name),
      raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
    `)
    .eq("id", itemId)
    .eq("status", "active");
    
  if (options?.siteId) {
    query = query.eq("site_id", options.siteId);
  }
  
  if (options?.requireMarketplace) {
    query = query.eq("is_marketplace_listed", true).eq("availability_status", "available");
  }
  
  const { data: item, error } = await query.single();
  
  if (error || !item) return null;
  
  // Get price and inventory for single item
  const [{ data: defaultList }, { data: inventoryLevels }, { data: settings }] = await Promise.all([
    supabase
      .from("price_lists")
      .select("id")
      .eq("site_id", item.site_id)
      .eq("is_default", true)
      .single(),
    supabase
      .from("inventory_levels")
      .select("quantity")
      .eq("catalog_item_id", item.id),
    supabase
      .from("settings")
      .select("commerce, default_locale")
      .eq("site_id", item.site_id)
      .single()
  ]);

  let finalPrice = item.target_sale_price;
  if (defaultList) {
    const { data: price } = await supabase
      .from("price_list_items")
      .select("unit_price")
      .eq("price_list_id", defaultList.id)
      .eq("catalog_item_id", item.id)
      .single();
    if (price && price.unit_price !== undefined && price.unit_price !== null && price.unit_price !== 0) {
      finalPrice = price.unit_price;
    }
  }

  let sellable = true;
  let availableQty: number | undefined = undefined;

  const commerceSettings = settings?.commerce as any || { stock_shortage_policy: 'allow' };
  const policy = commerceSettings.stock_shortage_policy || 'allow';

  if (item.availability_mode === 'manual') {
    sellable = item.availability_status === 'available';
  } else if (item.availability_mode === 'inventory') {
    availableQty = inventoryLevels?.reduce((acc: number, level: any) => acc + Number(level.quantity), 0) || 0;
    sellable = (availableQty ?? 0) > 0 || policy !== 'block';
  }

  // Fetch children if it's a parent
  let children: CatalogItem[] = [];
  if (item.metadata?.variant_axes?.length) {
    const { data: childrenData } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", item.id)
      .eq("status", "active")
      .eq("is_purchasable", true);
    
    if (childrenData) {
      children = childrenData as CatalogItem[];
    }
  }

  // Inherit display fields from parent service / product when this is a child variant
  let parent: (CatalogItem & { item_specs?: any[] }) | null = null;
  if (item.parent_id) {
    const { data: parentRow } = await supabase
      .from("catalog_items")
      .select(`
        *,
        raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))
      `)
      .eq("id", item.parent_id)
      .maybeSingle();

    if (parentRow) {
      parent = {
        ...(parentRow as CatalogItem),
        item_specs: ((parentRow as any).raw_specs || [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((cis: any) => cis.item_spec)
          .filter(Boolean),
      };
    }
  }

  const siteRow = item.site as { id: string; name: string; logo_url: string | null } | null | undefined
  const defaultLocale =
    (settings as { default_locale?: string } | null)?.default_locale || undefined

  const withSpecs = {
    ...item,
    site: siteRow
      ? {
          ...siteRow,
          settings: {
            default_locale: defaultLocale,
          },
        }
      : siteRow,
    item_specs: ((item as any).raw_specs || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((cis: any) => cis.item_spec).filter(Boolean),
    target_sale_price: finalPrice,
    _shop: {
      categoryName: Array.isArray(item.category) ? item.category[0]?.name : item.category?.name,
      sellable,
      availableQty,
      children
    }
  };

  return mergeParentIntoCatalogItem(withSpecs as any, parent);
}