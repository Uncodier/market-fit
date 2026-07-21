import { getShopSite, getShopCatalog, getShopLocations } from "./actions"
import { notFound } from "next/navigation"
import ShopClient from "./ShopClient"

export default async function ShopPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params
  const site = await getShopSite(siteSlug)
  
  if (!site) {
    notFound()
  }

  const [{ data: catalogItems }, { data: locations }] = await Promise.all([
    getShopCatalog(site.id),
    getShopLocations(site.id)
  ])

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <ShopClient 
        site={site} 
        initialCatalog={catalogItems as any[]} 
        locations={locations as any[]} 
      />
    </div>
  )
}
