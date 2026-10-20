import { NextResponse } from "next/server"
import { loadMarketplaceProducts } from "@/app/marketplace/load-marketplace-products"
import { parseMarketplaceProductsRequest } from "@/app/marketplace/marketplace-products-request"
import { CatalogSearchError } from "@/lib/catalog-search/server"

/** Anonymous browsing is intentional; the loader authorizes public listings only. */
export async function GET(request: Request) {
  const filters = parseMarketplaceProductsRequest(new URL(request.url).searchParams)
  if (!filters) return NextResponse.json({ error: "Invalid marketplace filters" }, { status: 400 })
  try {
    const { items, ...metadata } = await loadMarketplaceProducts(filters)
    return NextResponse.json({ data: items, ...metadata, page: filters.page, limit: filters.limit }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof CatalogSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.status,
        headers: { "Cache-Control": "no-store" } })
    }
    console.error("[marketplace] Failed to load products", error)
    return NextResponse.json({ error: "Unable to load marketplace products" }, { status: 500 })
  }
}
