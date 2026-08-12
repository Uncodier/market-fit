import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { getShopSite } from "../actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { createClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import { buildCatalogItemShareMetadata } from "@/app/lib/commerce-metadata"
import { ShopSlugNotFound } from "../ShopSlugNotFound"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string, itemId: string }> | { siteSlug: string, itemId: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  const itemId = 'itemId' in resolvedParams ? resolvedParams.itemId : undefined;
  
  if (!itemId) return { title: 'Shop Item | Makinari' };
  
  const item = await getPdpCatalogItem(itemId);
  if (!item) return { title: 'Shop Item | Makinari' };

  const path = siteSlug
    ? `/shop/${siteSlug}/${itemId}`
    : `/shop/${itemId}`;

  return buildCatalogItemShareMetadata(item as any, path);
}

export default async function ShopItemPage({ params }: { params: Promise<{ siteSlug: string, itemId: string }> | { siteSlug: string, itemId: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  const itemId = 'itemId' in resolvedParams ? resolvedParams.itemId : undefined;
  
  if (!siteSlug || !itemId) {
    return <ShopSlugNotFound slug={siteSlug} />
  }

  // Prefer resolving via catalog item (includes site join) so a flaky slug scan
  // does not block the PDP when we already have a stable item id.
  const item = await getPdpCatalogItem(itemId)
  if (!item) {
    notFound()
  }

  const siteFromItem = (item as any).site as {
    id: string
    name: string
    logo_url: string | null
    settings?: { default_locale?: string }
  } | null | undefined
  const siteSlugFromName = siteFromItem?.name
    ? siteFromItem.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    : null
  const siteMatchesSlug =
    !!siteFromItem &&
    (siteFromItem.id === siteSlug || siteSlugFromName === siteSlug)

  let site = siteMatchesSlug ? siteFromItem : null
  if (!site) {
    const resolved = await getShopSite(siteSlug)
    if (!resolved) {
      return <ShopSlugNotFound slug={siteSlug} />
    }
    if (resolved.id !== (item as any).site_id) {
      notFound()
    }
    site = resolved
  }

  let experience = undefined
  if (item.is_recurring) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('buyer_user_id', user.id)
        .eq('catalog_item_id', item.id)
        .in('status', ['active', 'paused'])
        .maybeSingle()
        
      if (subscription) {
        experience = { kind: 'subscription', subscription }
      }
    }
  }

  const siteDefaultLocale = site?.settings?.default_locale

  return (
    <>
      <SiteLocaleBootstrap locale={siteDefaultLocale} />
      <ProductDetailPage item={item as any} site={site} backUrl={`/shop/${siteSlug}`} experience={experience as any} />
    </>
  )
}