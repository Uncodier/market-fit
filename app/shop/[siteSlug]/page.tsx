import { getShopSite, getShopCatalog, getShopCategories, getShopLocations, getShopUserOwnedItems, getShopItemsByIds } from "./actions"
import { notFound } from "next/navigation"
import ShopClient from "./ShopClient"
import { Metadata } from "next"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { buildShopShareMetadata } from "@/app/lib/commerce-metadata"

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  if (!siteSlug) return { title: 'Shop | Makinari' };

  const site = await getShopSite(siteSlug);
  if (!site) return { title: 'Shop | Makinari' };

  return buildShopShareMetadata(site, `/shop/${siteSlug}`);
}

export default async function ShopPage({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  
  if (!siteSlug) {
    notFound();
  }

  const site = await getShopSite(siteSlug);
  
  if (!site) {
    notFound()
  }

  const [{ data: catalogItems, count, totalPages }, categories, { data: locations }, ownedItemIds, buyerGeo] = await Promise.all([
    getShopCatalog(site.id, { page: 1, pageSize: 20 }),
    getShopCategories(site.id),
    getShopLocations(site.id),
    getShopUserOwnedItems(site.id),
    getBuyerGeoApprox()
  ])

  const ownedIds = ownedItemIds.map(o => o.catalogItemId)
  const { data: ownedItemsData } = await getShopItemsByIds(site.id, ownedIds)

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <ShopClient 
        site={site} 
        initialCatalog={catalogItems as any[]} 
        initialCategories={categories}
        initialCount={count || 0}
        initialTotalPages={totalPages || 0}
        locations={locations as any[]} 
        ownedItemIds={ownedItemIds}
        ownedItemsData={ownedItemsData as any[]}
        buyerGeo={buyerGeo}
      />
    </div>
  )
}
