import { getShopSite, getShopCatalog, getShopLocations, getShopUserOwnedItems } from "./actions"
import { notFound } from "next/navigation"
import ShopClient from "./ShopClient"

export const revalidate = 0;
export const dynamic = 'force-dynamic';

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

  const [{ data: catalogItems }, { data: locations }, ownedItemIds] = await Promise.all([
    getShopCatalog(site.id),
    getShopLocations(site.id),
    getShopUserOwnedItems(site.id)
  ])

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <ShopClient 
        site={site} 
        initialCatalog={catalogItems as any[]} 
        locations={locations as any[]} 
        ownedItemIds={ownedItemIds}
      />
    </div>
  )
}
