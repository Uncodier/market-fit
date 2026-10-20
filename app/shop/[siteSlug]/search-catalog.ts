import "server-only"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { searchCatalogWindow } from "@/lib/catalog-search/server"
import { orderCatalogSearchRows } from "@/lib/catalog-search/types"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import type { CatalogItem } from "@/app/types"
import { SHOP_UNCATEGORIZED_NAME } from "./shop-catalog-shared"
import { publicListingMetadata } from "@/app/catalog/public-listing-metadata"

const optionsSchema = z.object({
  siteId: z.string().uuid(), search: z.string().trim().min(1).max(200),
  category: z.string().max(200), offset: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
})
type Client = Awaited<ReturnType<typeof createServiceClient>>
type Enrich = (siteId: string, items: CatalogItem[], client: Client) => Promise<CatalogItem[]>
// Unlike administrative reads, public hydration must never expose costs or internal specs.
const columns = "id, site_id, kind, name, description, sku, target_sale_price, currency, track_inventory, availability_mode, availability_status, status, metadata, created_at, updated_at, category_id, is_recurring, is_reservation, image_url, digital_subtype, is_marketplace_listed, parent_id, is_purchasable, pass_uses, pass_validity_days, is_dynamic_price, redeem_assignment_mode, sort_order, site:sites!inner(id), category:catalog_categories(name, sort_order), raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(id, name, image_url, video_url, address, city, category:item_spec_categories(slug, name)))"

export async function loadShopSearch(options: z.input<typeof optionsSchema>, enrich: Enrich) {
  const { siteId, search, category, offset, pageSize } = optionsSchema.parse(options)
  const page = Math.floor(offset / pageSize) + 1
  const supabase = await createServiceClient(true)
  let categoryIds: string[] | undefined
  if (category !== "all" && category !== SHOP_UNCATEGORIZED_NAME) {
    const result = await supabase.from("catalog_categories").select("id").eq("site_id", siteId).eq("name", category)
    if (result.error) throw new Error("Unable to load shop category")
    categoryIds = (result.data || []).map((row: { id: string }) => row.id)
  }
  const result = await searchCatalogWindow({ query: search, channel: "shop", site_id: siteId, filters: {
    status: "active", is_marketplace_listed: true, parent_id: null,
    category_id: category === SHOP_UNCATEGORIZED_NAME ? null : categoryIds?.length === 1 ? categoryIds[0] : undefined,
  } })
  const publicQuery = (selection: string) => {
    let query = applyStorefrontAvailability(supabase.from("catalog_items").select(selection)
      .eq("site_id", siteId).eq("status", "active").eq("is_marketplace_listed", true)
      .is("parent_id", null).is("site.archived_at", null))
    if (categoryIds?.length) query = query.in("category_id", categoryIds)
    if (category === SHOP_UNCATEGORIZED_NAME) query = query.is("category_id", null)
    return query
  }
  const candidates = result.items.length && (!categoryIds || categoryIds.length)
    ? await publicQuery("id, site_id, site:sites!inner(id)").in("id", result.items.map(item => item.id))
    : { data: [], error: null }
  if (candidates.error) throw new Error("Unable to load shop search")
  const ranked = orderCatalogSearchRows(result.items, (candidates.data || []) as Array<{ id: string; site_id: string }>)
  const pageIds = ranked.slice(offset, offset + pageSize)
  const rows = pageIds.length ? await publicQuery(columns).in("id", pageIds.map(item => item.id)) : { data: [], error: null }
  if (rows.error) throw new Error("Unable to load shop search")
  const enriched = await enrich(siteId, orderCatalogSearchRows(pageIds, (rows.data || []) as CatalogItem[]), supabase)
  const data = enriched.map(item => {
    const listing = { ...item } as CatalogItem & { raw_specs?: unknown; site?: unknown }
    delete listing.raw_specs
    delete listing.site
    return { ...listing, metadata: publicListingMetadata(item.metadata) }
  })
  return { data, error: undefined as string | undefined, count: ranked.length, totalPages: Math.ceil(ranked.length / pageSize), page, pageSize, offset,
    count_kind: result.count_kind, has_more: offset + pageSize < ranked.length,
    candidate_window_truncated: result.candidate_window_truncated === true,
    mode: result.mode, result_kind: result.result_kind ?? "matched", degraded: result.degraded, search_id: result.search_id }
}