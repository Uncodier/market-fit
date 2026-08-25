import { createServiceClient } from "@/lib/supabase/server";
import { CatalogItem } from "@/app/types";
import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details";
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve";
import { loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices";

export async function getPdpCatalogItem(itemId: string, options?: { siteId?: string, requireMarketplace?: boolean }) {
  const supabase = await createServiceClient(true);
  
  let query = supabase
    .from("catalog_items")
    .select(`
      *,
      site:sites(id, name, logo_url, description),
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
  
  const channel = options?.requireMarketplace ? "marketplace" : "shop";

  const [priceData, { data: inventoryLevels }, { data: settings }] = await Promise.all([
    loadChannelPriceMap(supabase, [item.site_id], channel),
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

  const finalPrice =
    priceData.priceByItemId.get(item.id) ?? item.target_sale_price;

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

  // Load child SKUs for any parent listing (axes may be missing on legacy data)
  let children: CatalogItem[] = [];
  let variantAxes = item.metadata?.variant_axes || [];
  if (!item.parent_id) {
    const { data: childrenData } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", item.id)
      .eq("status", "active")
      .eq("is_purchasable", true);

    const pricedChildren = ((childrenData || []) as CatalogItem[]).map((child) => ({
      ...child,
      target_sale_price:
        priceData.priceByItemId.get(child.id) ?? child.target_sale_price,
    }));

    const resolved = resolveVariantAxesForDisplay(item as CatalogItem, pricedChildren);
    children = resolved.children;
    variantAxes = resolved.axes;
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

  const siteRow = item.site as {
    id: string
    name: string
    logo_url: string | null
    description?: string | null
  } | null | undefined
  const defaultLocale =
    (settings as { default_locale?: string } | null)?.default_locale || undefined

  const hasVariants = children.length > 0 || variantAxes.length > 0
  const categoryName = Array.isArray(item.category)
    ? item.category[0]?.name
    : item.category?.name
  const siteDescription = siteRow?.description || null

  const withSpecs = {
    ...item,
    metadata: {
      ...(item.metadata || {}),
      variant_axes: variantAxes,
    },
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
      categoryName,
      siteDescription,
      sellable: hasVariants ? false : sellable,
      availableQty,
      children,
      hasVariants,
    }
  };

  return mergeParentIntoCatalogItem(withSpecs as any, parent);
}

/** Lightweight PDP row for generateMetadata so loading.tsx can paint while the full item loads. */
export async function getPdpShareItem(
  itemId: string,
  options?: { requireMarketplace?: boolean },
) {
  const supabase = await createServiceClient(true)
  let query = supabase
    .from("catalog_items")
    .select("name, description, image_url, metadata, site:sites(name)")
    .eq("id", itemId)
    .eq("status", "active")

  if (options?.requireMarketplace) {
    query = query.eq("is_marketplace_listed", true).eq("availability_status", "available")
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return data
}