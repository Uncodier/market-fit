import { getShopSite, getShopCatalog, getShopCategoryOffsets, getShopLocations } from "../actions"
import ShopClient from "../ShopClient"
import { Metadata } from "next"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { buildShopShareMetadata } from "@/app/lib/commerce-metadata"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { SHOP_PAGE_SIZE, SHOP_UNCATEGORIZED_NAME, uniqueCategoryNames } from "../shop-catalog-shared"
import { getShopMerchandising } from "@/app/promotions/storefront-promotions"
import { ShopSlugNotFound } from "../ShopSlugNotFound"

// Literal required: Next.js cannot statically analyze imported segment config values.
// Keep in sync with SHOP_CACHE_REVALIDATE_SECONDS in ./shop-catalog-shared
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  if (!siteSlug) return { title: 'Shop | Makinari' };

  const site = await getShopSite(siteSlug);
  if (!site) return { title: 'Shop Not Found | Makinari' };

  return buildShopShareMetadata(site, `/shop/${siteSlug}`);
}

export default async function ShopPage({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  
  if (!siteSlug) {
    return <ShopSlugNotFound />
  }

  const site = await getShopSite(siteSlug);
  
  if (!site) {
    return <ShopSlugNotFound slug={siteSlug} />
  }

  const timezone = site?.settings?.business_hours?.[0]?.timezone || null
  const [{ data: catalogItems, count }, categoryOffsets, { data: locations }, buyerGeo, merchandising] = await Promise.all([
    getShopCatalog(site.id, { offset: 0, pageSize: SHOP_PAGE_SIZE }),
    getShopCategoryOffsets(site.id),
    getShopLocations(site.id),
    getBuyerGeoApprox(),
    getShopMerchandising({ siteId: site.id, siteSlug, timezone }),
  ])

  const categories = uniqueCategoryNames(
    categoryOffsets
      .map((o) => o.name)
      .filter((name) => name !== SHOP_UNCATEGORIZED_NAME)
  )

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <ShopClient 
        site={site} 
        initialCatalog={catalogItems as any[]} 
        initialCategories={categories}
        initialCategoryOffsets={categoryOffsets}
        initialCount={count || 0}
        locations={locations as any[]} 
        buyerGeo={buyerGeo}
        generalPromos={merchandising.general}
        promoBadgesByItemId={merchandising.byItemId}
        categoryPromosByName={merchandising.categoryPromosByName}
      />
    </div>
  )
}
