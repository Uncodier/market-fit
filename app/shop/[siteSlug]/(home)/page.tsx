import { Suspense } from "react"
import { getShopSite, getShopCatalog, getShopCategoryOffsets, getShopLocations } from "../actions"
import ShopClient from "../ShopClient"
import { Metadata } from "next"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { buildShopShareMetadata } from "@/app/lib/commerce-metadata"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { SHOP_PAGE_SIZE, SHOP_UNCATEGORIZED_NAME, uniqueCategoryNames } from "../shop-catalog-shared"
import { getShopMerchandising } from "@/app/promotions/storefront-promotions"
import { ShopSlugNotFound } from "../ShopSlugNotFound"
import { ShopHomeSkeleton } from "../ShopHomeSkeleton"
import { getShopRouteContext, type ShopSelfServiceContext } from "../shop-route-context"
import { SelfServiceShopClient } from "../self-service/SelfServiceShopClient"
import type { CatalogItem } from "@/app/types"

// Literal required: Next.js cannot statically analyze imported segment config values.
// Keep in sync with SHOP_CACHE_REVALIDATE_SECONDS in ./shop-catalog-shared
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  if (!siteSlug) return { title: 'Shop | Makinari' };

  const context = await getShopRouteContext(siteSlug);
  const site = context?.site;
  if (!site) return { title: 'Shop Not Found | Makinari' };

  return buildShopShareMetadata(site, `/shop/${siteSlug}`);
}

export default async function ShopPage({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  
  if (!siteSlug) {
    return <ShopSlugNotFound />
  }

  const context = await getShopRouteContext(siteSlug);
  const site = context?.site;
  
  if (!site) {
    return <ShopSlugNotFound slug={siteSlug} />
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <Suspense fallback={context?.selfService ? <div className="p-8" role="status">Loading menu…</div> : <ShopHomeSkeleton site={site} />}>
        <ShopCatalogPage site={site} siteSlug={siteSlug} selfService={context?.selfService} />
      </Suspense>
    </div>
  )
}

async function ShopCatalogPage({
  site,
  siteSlug,
  selfService,
}: {
  site: NonNullable<Awaited<ReturnType<typeof getShopSite>>>
  siteSlug: string
  selfService?: ShopSelfServiceContext | null
}) {
  const timezone = site?.settings?.business_hours?.[0]?.timezone || null
  const [{ data: catalogItems, count }, categoryOffsets, { data: locations }, buyerGeo, merchandising] = await Promise.all([
    getShopCatalog(site.id, { offset: 0, pageSize: SHOP_PAGE_SIZE, ...(selfService ? { selfServiceLocationId: selfService.location.id } : {}) }),
    getShopCategoryOffsets(site.id),
    selfService ? Promise.resolve({ data: [] }) : getShopLocations(site.id),
    selfService ? Promise.resolve(undefined) : getBuyerGeoApprox(),
    getShopMerchandising({ siteId: site.id, siteSlug, timezone }),
  ])

  const categories = uniqueCategoryNames(
    categoryOffsets
      .map((o) => o.name)
      .filter((name) => name !== SHOP_UNCATEGORIZED_NAME)
  )

  if (selfService) return <SelfServiceShopClient
    initialCatalog={catalogItems as CatalogItem[]} initialCount={count || 0} initialCategoryOffsets={categoryOffsets}
    generalPromos={merchandising.allPromos} promoBadgesByItemId={merchandising.byItemId}
    categoryPromosByName={merchandising.categoryPromosByName} />

  return (
    <ShopClient
      site={site}
      initialCatalog={catalogItems as CatalogItem[]}
      initialCategories={categories}
      initialCategoryOffsets={categoryOffsets}
      initialCount={count || 0}
      locations={locations || []}
      buyerGeo={buyerGeo}
      generalPromos={merchandising.general}
      promoBadgesByItemId={merchandising.byItemId}
      categoryPromosByName={merchandising.categoryPromosByName}
    />
  )
}
