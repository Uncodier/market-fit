import { Suspense } from "react"
import { getPdpCatalogItem, getPdpShareItem } from "@/app/commerce/pdp-actions"
import { getShopSite, getShopCatalogSize } from "../actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { Metadata } from "next"
import { buildCatalogItemShareMetadata } from "@/app/lib/commerce-metadata"
import { ShopSlugNotFound } from "../ShopSlugNotFound"
import { PdpPageSkeleton } from "@/app/components/commerce/pdp/PdpPageSkeleton"
import { getShopRouteContext } from "../shop-route-context"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import { loadSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options"
import { SelfServiceProductDetail } from "../self-service/SelfServiceProductDetail"
import { enrichSelfServiceInventory } from "../self-service-catalog"

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string, itemId: string }> | { siteSlug: string, itemId: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  const itemId = 'itemId' in resolvedParams ? resolvedParams.itemId : undefined;
  
  if (!itemId) return { title: 'Shop Item | Makinari' };
  
  const item = await getPdpShareItem(itemId, { requireStorefront: true });
  if (!item) return { title: 'Shop Item | Makinari' };

  const path = siteSlug
    ? `/shop/${siteSlug}/${itemId}`
    : `/shop/${itemId}`;

  return buildCatalogItemShareMetadata(item, path);
}

export default async function ShopItemPage({ params }: { params: Promise<{ siteSlug: string, itemId: string }> | { siteSlug: string, itemId: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  const itemId = 'itemId' in resolvedParams ? resolvedParams.itemId : undefined;
  
  if (!siteSlug || !itemId) {
    return <ShopSlugNotFound slug={siteSlug} />
  }
  const context = await getShopRouteContext(siteSlug)

  return (
    <Suspense fallback={context?.selfService ? <div className="p-8" role="status">Loading product…</div> : <PdpPageSkeleton />}>
      <ShopItemContent siteSlug={siteSlug} itemId={itemId} />
    </Suspense>
  )
}

async function ShopItemContent({ siteSlug, itemId }: { siteSlug: string; itemId: string }) {
  const context = await getShopRouteContext(siteSlug)
  if (context?.selfService) {
    const item = await getPdpCatalogItem(itemId, { requireStorefront: true })
    const { location, fulfillmentOptions } = context.selfService
    if (!item || item.site_id !== context.site.id || !isSelfServiceItem(item, fulfillmentOptions, location.id)) notFound()
    const [branchItem] = await enrichSelfServiceInventory(context.site.id, location.id, [item])
    const fulfillment = fulfillmentOptions[0]
    const modifiers = await loadSelfServiceModifierOptions({ locationId: location.id, hostId: item.id, fulfillment })
    return <>
      <SiteLocaleBootstrap locale={context.site.settings?.default_locale} />
      <SelfServiceProductDetail item={branchItem} modifierGroups={modifiers.data} modifierError={modifiers.error}
        modifierFulfillment={fulfillment} modifierUnavailableReason={modifiers.unavailableReason} />
    </>
  }
  // Prefer resolving via catalog item (includes site join) so a flaky slug scan
  // does not block the PDP when we already have a stable item id.
  const item = await getPdpCatalogItem(itemId, { requireStorefront: true })
  if (!item) {
    notFound()
  }

  const siteFromItem = item.site as {
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
    if (resolved.id !== item.site_id) {
      notFound()
    }
    site = resolved
  }

  const siteDefaultLocale = site?.settings?.default_locale

  let catalogSize = 0;
  if (site) {
    catalogSize = await getShopCatalogSize(site.id);
  }

  return (
    <>
      <SiteLocaleBootstrap locale={siteDefaultLocale} />
      <ProductDetailPage item={item} site={site} backUrl={`/shop/${siteSlug}`} catalogSize={catalogSize} />
    </>
  )
}
