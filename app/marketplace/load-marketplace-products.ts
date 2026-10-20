import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import type { CatalogItem } from "@/app/types"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import { attachSiteSettings } from "./attach-site-settings"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { loadVariantListingPreviews } from "@/app/catalog/variant-resolve"
import { loadStorefrontDisplay } from "@/app/commerce/storefront-display"
import { getUsdFxRates } from "@/app/lib/fx-rates"
import { loadMarketplaceSales, readAllRows } from "./load-marketplace-sales"
import { rankMarketplaceCandidates } from "./marketplace-ranking"
import type { MarketplaceSort } from "./marketplace-sort"
import { MARKETPLACE_PAGE_SIZE } from "./marketplace-pagination"
import { loadMarketplaceAreas } from "./load-marketplace-regions"
import { filterMarketplaceAvailability, type AvailabilityCandidate } from "./load-marketplace-availability"
import { filterMarketplaceGeography, filterMarketplacePrices, marketplaceRegions, type MarketplaceListingFilters } from "./marketplace-product-filters"
import { searchCatalogWindow } from "@/lib/catalog-search/server"
import { orderCatalogSearchRows, type CatalogSearchFilters } from "@/lib/catalog-search/types"
import { publicListingMetadata } from "@/app/catalog/public-listing-metadata"

type MarketplaceItem = CatalogItem & {
  site: { id: string; name: string; logo_url?: string | null; settings?: Record<string, unknown> }
}

export type MarketplaceProductFilters = MarketplaceListingFilters & {
  page?: number
  limit?: number
  sort?: MarketplaceSort
  kind?: string | null
  digitalSubtype?: string | null
  siteId?: string | null
  search?: string | null
  search_id?: string
  isRecurring?: boolean
  buyerGeo?: BuyerGeo
}

// Public listing fields only: never select cost, internal pricing limits, or ownership.
const LISTING_COLUMNS = "id, site_id, kind, name, description, sku, target_sale_price, currency, track_inventory, availability_mode, availability_status, status, metadata, created_at, updated_at, category_id, is_recurring, is_reservation, image_url, digital_subtype, is_marketplace_listed, parent_id, is_purchasable, pass_uses, pass_validity_days, is_dynamic_price, redeem_assignment_mode, sort_order, site:sites!inner(id, name, logo_url)"
const SPEC_COLUMNS = ", raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(id, name, image_url, video_url, address, city, category:item_spec_categories(slug, name)))"

export async function loadMarketplaceProducts(filters: MarketplaceProductFilters = {}) {
  // Intentionally public read: authorization is limited to active, listed parent items
  // from non-archived sites. The service client and sales rows remain server-only.
  const supabase = await createServiceClient(true)
  const page = filters.page || 1
  const limit = filters.limit || MARKETPLACE_PAGE_SIZE
  const sort = filters.sort || "featured"
  const search = filters.search?.trim() ? await searchCatalogWindow({
    query: filters.search, channel: "marketplace", site_id: filters.siteId || undefined, search_id: filters.search_id,
    filters: {
      kind: filters.kind && filters.kind !== "all" ? filters.kind as CatalogSearchFilters["kind"] : undefined,
      digital_subtype: filters.digitalSubtype && filters.digitalSubtype !== "all" ? filters.digitalSubtype : undefined,
      is_recurring: filters.isRecurring || undefined,
      status: "active", is_marketplace_listed: true, parent_id: null,
    },
  }) : null
  const searchMetadata = search ? { count_kind: search.count_kind, mode: search.mode, result_kind: search.result_kind ?? "matched",
    candidate_window_truncated: search.candidate_window_truncated === true,
    degraded: search.degraded, search_id: search.search_id } : { count_kind: "exact" as const }
  const publicQuery = (columns: string) => {
    let query = applyStorefrontAvailability(supabase.from("catalog_items").select(columns)
      .is("site.archived_at", null).eq("is_marketplace_listed", true)
      .eq("status", "active").is("parent_id", null))
    if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind)
    if (filters.digitalSubtype && filters.digitalSubtype !== "all") query = query.eq("digital_subtype", filters.digitalSubtype)
    if (filters.siteId) query = query.eq("site_id", filters.siteId)
    if (filters.isRecurring) query = query.eq("is_recurring", true)
    return query
  }
  const candidateColumns = "id, site_id, created_at, target_sale_price, currency, availability_mode, availability_status, is_purchasable, site:sites!inner(id)"
  let candidates: AvailabilityCandidate[]
  if (search) {
    const result = search.items.length ? await publicQuery(candidateColumns).in("id", search.items.map(item => item.id)) : { data: [], error: null }
    if (result.error) throw new Error("Unable to load marketplace candidates")
    candidates = orderCatalogSearchRows(search.items, (result.data || []) as AvailabilityCandidate[])
  } else {
    candidates = await readAllRows<AvailabilityCandidate>((from, to) => publicQuery(candidateColumns).order("id").range(from, to))
  }
  if (!candidates.length) return { items: [] as MarketplaceItem[], count: 0, totalPages: 0, regions: [], has_more: false, ...searchMetadata }

  const isPriceSort = !search && (sort === "price_asc" || sort === "price_desc")
  const needsPrices = isPriceSort || filters.minPrice != null || filters.maxPrice != null
  const [areas, pricedCandidates, fx] = await Promise.all([
    loadMarketplaceAreas(supabase, candidates),
    needsPrices ? applyChannelPricesToItems(supabase, candidates, "marketplace") : Promise.resolve(candidates),
    needsPrices ? getUsdFxRates() : Promise.resolve({ rates: {} }),
  ])
  candidates = filterMarketplacePrices(pricedCandidates, filters, fx.rates)
  if (filters.availableOnly) candidates = await filterMarketplaceAvailability(supabase, candidates)
  // Counts reflect category/search/price/availability, but not the chosen region.
  const regions = marketplaceRegions(candidates, areas)
  candidates = filterMarketplaceGeography(candidates, filters, areas, filters.buyerGeo)
  const count = candidates.length
  const scores = !search && (sort === "featured" || sort === "best_selling")
    ? await loadMarketplaceSales(supabase, candidates, sort === "featured" ? filters.buyerGeo : undefined)
    : new Map()
  const ranked = search ? candidates : rankMarketplaceCandidates(candidates, sort, scores, fx.rates)
  const pageIds = ranked.slice((page - 1) * limit, page * limit).map(item => item.id)
  const totalPages = Math.ceil(count / limit)
  if (!pageIds.length) return { items: [] as MarketplaceItem[], count, totalPages, regions, has_more: false, ...searchMetadata }

  const { data, error } = await publicQuery(LISTING_COLUMNS + SPEC_COLUMNS).in("id", pageIds)
  if (error) throw new Error(error.message)
  const byId = new Map(((data || []) as MarketplaceItem[]).map(item => [item.id, item]))
  const ordered = orderCatalogSearchRows(ranked.slice((page - 1) * limit, page * limit), (data || []) as MarketplaceItem[])
  const withSettings = await attachSiteSettings(supabase, ordered)
  const priced = await applyChannelPricesToItems(supabase, withSettings, "marketplace")
  const [previews, displayMap, inventory] = await Promise.all([
    loadVariantListingPreviews(supabase, priced.map(item => ({ id: item.id, name: item.name }))),
    loadStorefrontDisplay(supabase, priced),
    supabase.from("inventory_levels").select("catalog_item_id, site_id, quantity").in("catalog_item_id", pageIds),
  ])
  const inventoryMap = new Map<string, number>()
  for (const level of inventory.data || []) {
    if (level.site_id !== byId.get(level.catalog_item_id)?.site_id) continue
    inventoryMap.set(level.catalog_item_id, (inventoryMap.get(level.catalog_item_id) || 0) + Number(level.quantity))
  }
  const items = priced.map(item => {
    const { raw_specs: rawSpecs = [], ...listing } = item as MarketplaceItem & {
      raw_specs?: Array<{ sort_order: number; item_spec: NonNullable<CatalogItem["item_specs"]>[number] | null }>
    }
    const preview = previews.get(item.id)
    const settings = item.site.settings as { commerce?: { stock_shortage_policy?: string }; locations?: unknown; default_locale?: string } | undefined
    const hasVariants = Boolean(preview?.hasVariants || (item.metadata?.variant_axes?.length && item.is_purchasable === false))
    const availableQty = item.availability_mode === "inventory" ? inventoryMap.get(item.id) || 0 : undefined
    let sellable = item.availability_mode === "manual" ? item.availability_status === "available" : true
    if (availableQty !== undefined) sellable = availableQty > 0 || settings?.commerce?.stock_shortage_policy !== "block"
    if (item.is_purchasable === false && !hasVariants) sellable = false
    // Whitelist display metadata; seller prompts and operational metadata are private.
    return {
      ...listing,
      item_specs: [...rawSpecs].sort((a, b) => a.sort_order - b.sort_order)
        .flatMap(row => row.item_spec ? [row.item_spec] : []),
      metadata: publicListingMetadata(item.metadata),
      site: { id: item.site.id, name: item.site.name, logo_url: item.site.logo_url,
        settings: { locations: settings?.locations, default_locale: settings?.default_locale,
          commerce: { stock_shortage_policy: settings?.commerce?.stock_shortage_policy } } },
      _shop: { hasVariants, variantLabels: preview?.labels || [], sellable, availableQty, ...displayMap.get(item.id) },
    }
  })
  return { items: items as MarketplaceItem[], count, totalPages, regions, has_more: page < totalPages, ...searchMetadata }
}