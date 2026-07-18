import { getShopSite, getShopCatalog, getShopLocations } from "./actions"
import { notFound } from "next/navigation"
import ShopClient from "./ShopClient"

export default async function ShopPage({ params }: { params: { siteSlug: string } }) {
  const site = await getShopSite(params.siteSlug)
  
  if (!site) {
    notFound()
  }

  const [{ data: catalogItems }, { data: locations }] = await Promise.all([
    getShopCatalog(site.id),
    getShopLocations(site.id)
  ])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        <ShopClient 
          site={site} 
          initialCatalog={catalogItems as any[]} 
          locations={locations as any[]} 
        />
      </main>
      
      <footer className="bg-white border-t py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-sm text-gray-500">
          Powered by Uncodie
        </div>
      </footer>
    </div>
  )
}
